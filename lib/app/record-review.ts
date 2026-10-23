import { prisma } from '@/lib/db/db';
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
  errorTags?: string[];
  errorDetail?: Confusion[];
}

export interface RecordedReview {
  itemId: string;
  rating: RatingValue;
  next: SrsFields;
}

export async function recordReviews(
  reviews: readonly ReviewInput[],
  options: { retention: number; now: Date; alsoWrite?: Prisma.PrismaPromise<unknown>[] },
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
      prisma.srsState.update({ where: { itemId: review.itemId }, data: { ...next } }),
      prisma.reviewLog.create({
        data: {
          itemId: review.itemId,
          rating: log.rating,
          state: log.state,
          role: review.role ?? 'TARGET',
          due: log.due,
          stability: log.stability,
          difficulty: log.difficulty,
          reviewedAt: now,
          sentenceId: review.sentenceId ?? null,
          errorTags: review.errorTags?.length ? JSON.stringify(review.errorTags) : null,
          errorDetail: serializeErrorDetail(review.errorDetail),
        },
      }),
    );
    recorded.push({ itemId: review.itemId, rating: review.rating, next });
  }

  await prisma.$transaction(writes);
  return recorded;
}
