import type { UserDb } from '@/lib/db/user-db';
import { invalidateStreak } from '@/lib/insights/streak';
import type { Prisma } from '@/lib/generated/prisma/client';
import { serializeErrorDetail, type Confusion } from '@/lib/session/error-tags';
import type { ItemRole } from '@/lib/srs/select';
import { rateOnce, type RatingValue, type SrsFields } from '@/lib/srs/srs';

// The ONLY place that computes a new FSRS schedule and writes it, for every way of studying (a
// translation turn with Claude, a flash card, a cloze). One call commits the new SrsState rows, one
// appended ReviewLog row per review, and the caller's own rows, all in a single transaction.

export interface ReviewInput {
  itemId: string;
  srs: SrsFields;
  rating: RatingValue;
  role?: ItemRole;
  sentenceId?: string | null;
  turnId?: string | null;
  errorTags?: string[];
  errorDetail?: Confusion[];
  /** The device's id for this grade (U2e); a second row with the same id is refused (P2002). */
  clientId?: string | null;
}

// Where the review happened. Old callers (the pre-v2 MCP tools) leave it unset.
export type ReviewChannel = 'web' | 'mcp';

export interface RecordedReview {
  itemId: string;
  rating: RatingValue;
  next: SrsFields;
}

export async function recordReviews(
  db: UserDb,
  reviews: readonly ReviewInput[],
  options: {
    retention: number;
    now: Date;
    channel?: ReviewChannel;
    alsoWrite?: Prisma.PrismaPromise<unknown>[];
    /**
     * Write a schedule only if it is still the one each review was computed from: same `reps`
     * (every review adds one) and `state`. A grade sent from the background can arrive after another
     * one changed the card; then the whole call is refused with P2025 and nothing is written. Not
     * `due`: SQLite keeps it as text, and rows written by hand or by an older Prisma spell the same
     * time differently, so an equal date could fail to match.
     */
    onlyIfUnchanged?: boolean;
  },
): Promise<RecordedReview[]> {
  const { retention, now } = options;
  // Two reviews of one item in a call would both be computed from the same stale schedule.
  const ids = reviews.map((r) => r.itemId);
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i);
  if (repeated) throw new Error(`Item ${repeated} is reviewed twice in one call; send it once.`);
  const recorded: RecordedReview[] = [];
  const writes: Prisma.PrismaPromise<unknown>[] = [...(options.alsoWrite ?? [])];

  for (const review of reviews) {
    const { next, log } = rateOnce(review.srs, review.rating, { retention, now });
    writes.push(
      db.srsState.update({
        where: options.onlyIfUnchanged
          ? { itemId: review.itemId, reps: review.srs.reps, state: review.srs.state }
          : { itemId: review.itemId },
        data: { ...next },
      }),
      db.reviewLog.create({
        data: {
          userId: db.$ownerId(),
          itemId: review.itemId,
          rating: log.rating,
          state: log.state,
          role: review.role ?? 'TARGET',
          due: log.due,
          stability: log.stability,
          difficulty: log.difficulty,
          reviewedAt: now,
          sentenceId: review.sentenceId ?? null,
          turnId: review.turnId ?? null,
          channel: options.channel ?? null,
          errorTags: review.errorTags?.length ? JSON.stringify(review.errorTags) : null,
          errorDetail: serializeErrorDetail(review.errorDetail),
          clientId: review.clientId ?? null,
        },
      }),
    );
    recorded.push({ itemId: review.itemId, rating: review.rating, next });
  }

  await db.$transaction(writes);
  invalidateStreak(db.$ownerId());
  return recorded;
}
