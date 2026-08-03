// Read-only per-item analytics ("card info", Anki-style) for /resources/[id]. Reads the FSRS state +
// the append-only ReviewLog for ONE item and derives the display metrics (recall probability, correct
// rate, forgetting curve). Pure reporting — never writes; the practice loop stays in lib/practice.ts.

import { prisma } from '@/lib/db';
import { parseEnrichment } from '@/lib/enrichment';
import { parseErrorTags, type ErrorTag } from '@/lib/error-tags';
import { getSettings } from '@/lib/practice';
import { forgettingCurve, retrievability, type SrsFields } from '@/lib/srs';

const GRAMMAR_KIND = 'GRAMMAR';
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

/** A near-synonym from `enrichment.contrasts` that IS in the library, so it can be linked to. */
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
  /** Contrast targets that exist in the library — rendered as links, turning the store into a graph. */
  contrastLinks: ContrastLink[];
}

/**
 * Full analytics for one item, or null if the id doesn't exist. Fetches the whole review log (single
 * user → at most tens of rows per item) so the page can show every review + build the curve.
 */
export async function getItemStats(
  itemId: string,
  now: Date = new Date(),
): Promise<ItemStats | null> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      srs: true,
      reviews: {
        orderBy: { reviewedAt: 'desc' },
        // `sourceRuby` rides along with the text: without it the review log renders SpokenLine with
        // showFurigana but no ruby data, so furigana silently never appears (invariant #9 needs all
        // three signals, not just audio). Same gap the community feed had.
        include: { sentence: { select: { sourceText: true, sourceRuby: true } } },
      },
    },
  });
  if (!item) return null;

  const { desiredRetention } = await getSettings();

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

  // One query for every contrast target; a contrast naming a pattern the user does not own simply
  // stays plain text rather than becoming a dead link.
  const contrastLinks = await resolveContrastLinks(item.enrichment, item.id);

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

/**
 * Look up which of an enrichment card's `contrasts[].with` entries are themselves items in the
 * library, so the detail page can link to their pages. Returns [] when the card has no contrasts or
 * cannot be parsed — a missing link degrades to plain text, never to an error.
 */
async function resolveContrastLinks(
  enrichment: string | null,
  selfId: string,
): Promise<ContrastLink[]> {
  const parsed = parseEnrichment(enrichment);
  const wanted = parsed?.contrasts.map((c) => c.with) ?? [];
  if (wanted.length === 0) return [];

  const rows = await prisma.item.findMany({
    where: { kind: GRAMMAR_KIND, expression: { in: wanted }, id: { not: selfId } },
    select: { id: true, expression: true },
  });
  return rows.map((r) => ({ expression: r.expression, itemId: r.id }));
}
