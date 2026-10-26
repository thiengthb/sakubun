import type { UserDb } from '@/lib/db/user-db';
import { parseEnrichment } from '@/lib/library/enrichment';
import { parseErrorTags, type ErrorTag } from '@/lib/session/error-tags';
import { GRAMMAR_KIND } from '@/lib/library/item-kinds';
import { getSettings } from '@/lib/library/practice';
import { forgettingCurve, retrievability, type SrsFields } from '@/lib/srs/srs';

const DAY_MS = 86_400_000;

export interface ItemReviewRow {
  id: string;
  reviewedAt: Date;
  rating: number;
  stateBefore: number; // ts-fsrs state at review time (0 = first-ever review)
  role: string; // TARGET | SECONDARY
  errorTags: ErrorTag[];
  stability: number; // AFTER this review
  difficulty: number; // AFTER this review
  due: Date; // scheduled AFTER this review
  sentenceId: string | null;
  sentenceText: string | null; // source sentence this review came from (null if deleted / pre-audit)
  sentenceRuby: string | null; // `漢字[かな]` markup for sentenceText, so the log can show furigana
}

export interface ContrastLink {
  expression: string;
  itemId: string;
}

export interface ItemStats {
  itemId: string;
  kind: 'grammar' | 'vocab';
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string;
  level: string;
  notes: string | null;
  enrichment: string | null; // raw JSON — the page parses it (grammar only)
  suspended: boolean;
  starred: boolean;
  createdAt: Date;
  srs: {
    state: number;
    due: Date;
    stability: number;
    difficulty: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    lastReview: Date | null;
  } | null;
  retrievability: number | null; // 0–1 recall probability NOW (null when never reviewed)
  retention: number; // settings.desiredRetention — the curve + due target were computed against this
  nowDay: number | null; // days from lastReview → query time (the curve's "now" marker; null if new)
  forgettingCurve: { day: number; r: number }[]; // for the mini chart (empty when never reviewed)
  reviews: ItemReviewRow[]; // newest first — includes SECONDARY-role logs
  reviewCount: number;
  correctCount: number; // reviews with rating ≥ 3
  firstReviewedAt: Date | null;
  contrastLinks: ContrastLink[];
}

export async function getItemStats(
  db: UserDb,
  itemId: string,
  now: Date = new Date(),
): Promise<ItemStats | null> {
  const item = await db.item.findUnique({
    where: { id: itemId },
    include: {
      srs: true,
      reviews: {
        orderBy: { reviewedAt: 'desc' },
        include: { sentence: { select: { sourceText: true, sourceRuby: true } } },
      },
    },
  });
  if (!item) return null;

  const { desiredRetention } = await getSettings(db);

  const srsFields: SrsFields | null = item.srs
    ? {
        due: item.srs.due,
        stability: item.srs.stability,
        difficulty: item.srs.difficulty,
        scheduledDays: item.srs.scheduledDays,
        learningSteps: item.srs.learningSteps,
        reps: item.srs.reps,
        lapses: item.srs.lapses,
        state: item.srs.state,
        lastReview: item.srs.lastReview,
      }
    : null;

  const reviews: ItemReviewRow[] = item.reviews.map((r) => ({
    id: r.id,
    reviewedAt: r.reviewedAt,
    rating: r.rating,
    stateBefore: r.state,
    role: r.role,
    errorTags: parseErrorTags(r.errorTags),
    stability: r.stability,
    difficulty: r.difficulty,
    due: r.due,
    sentenceId: r.sentenceId,
    sentenceText: r.sentence?.sourceText ?? null,
    sentenceRuby: r.sentence?.sourceRuby ?? null,
  }));

  const contrastLinks = await resolveContrastLinks(db, item.enrichment, item.id, item.kind);

  return {
    itemId: item.id,
    kind: item.kind === GRAMMAR_KIND ? 'grammar' : 'vocab',
    expression: item.expression,
    reading: item.reading,
    hanviet: item.hanviet,
    meaningVi: item.meaningVi,
    level: item.level,
    notes: item.notes,
    enrichment: item.enrichment,
    suspended: item.suspended,
    starred: item.starred,
    createdAt: item.createdAt,
    srs: srsFields
      ? {
          state: srsFields.state,
          due: srsFields.due,
          stability: srsFields.stability,
          difficulty: srsFields.difficulty,
          scheduledDays: srsFields.scheduledDays,
          reps: srsFields.reps,
          lapses: srsFields.lapses,
          lastReview: srsFields.lastReview,
        }
      : null,
    retrievability: srsFields
      ? retrievability(srsFields, { retention: desiredRetention, now })
      : null,
    retention: desiredRetention,
    nowDay: srsFields?.lastReview
      ? (now.getTime() - srsFields.lastReview.getTime()) / DAY_MS
      : null,
    forgettingCurve: srsFields ? forgettingCurve(srsFields, { retention: desiredRetention }) : [],
    reviews,
    reviewCount: reviews.length,
    correctCount: reviews.filter((r) => r.rating >= 3).length,
    firstReviewedAt: reviews.length ? reviews[reviews.length - 1].reviewedAt : null,
    contrastLinks,
  };
}

async function resolveContrastLinks(
  db: UserDb,
  enrichment: string | null,
  selfId: string,
  kind: string,
): Promise<ContrastLink[]> {
  const parsed = parseEnrichment(enrichment);
  const wanted = [
    ...(parsed?.contrasts.map((c) => c.with) ?? []),
    ...(parsed?.synonyms.map((r) => r.term) ?? []),
    ...(parsed?.antonyms.map((r) => r.term) ?? []),
  ];
  if (wanted.length === 0) return [];

  const rows = await db.item.findMany({
    where: { kind, expression: { in: wanted }, id: { not: selfId } },
    select: { id: true, expression: true },
  });
  return rows.map((r) => ({ expression: r.expression, itemId: r.id }));
}
