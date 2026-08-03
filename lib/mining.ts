// Error-signature mining: turn the learner's OWN attested mistakes into a proposal to improve the
// DOMAIN model. PURE (rows in, ranked pairs out) so the thresholds are testable without a database.
//
// The gap it closes. sakubun has been an error-tagged learner corpus since the beginning
// (`lib/error-tags.ts`, 8 tags, grounded in Li 2010) and has never once READ its own corpus back —
// every session re-derived the same conclusions about the same learner from zero. The CALL literature
// is explicit that an error-tagged corpus pays off when the annotation is fine-grained enough to yield
// "detailed error statistics... used to focus teaching exercises on learners' attested difficulties".
// A flat tag cannot do that: "word-choice" is a category, 「ほかに instead of 〜どころか」 is a lesson.
// So `ReviewLog.errorDetail` records the PAIR (2026-07-27) and this module aggregates it.
//
// It writes NOTHING. It is an evidence source for `lib/coach.ts`, which proposes and waits for a yes —
// the same propose-never-write rule the rest of the agentic loop follows.

import type { Confusion, ErrorTag } from '@/lib/error-tags';
import { normalizeExpression, sameExpression } from '@/lib/normalize';

/** One review's worth of confusion data, as the DB hands it over. */
export interface ConfusionRow {
  /** The item being drilled — the `required` side is usually (not always) this item. */
  itemId: string | null;
  expression: string | null;
  sentenceId: string | null;
  reviewedAt: Date;
  confusions: Confusion[];
}

export interface MinedPair {
  /** Display forms, taken from the MOST RECENT occurrence (spellings drift; the newest is the live one). */
  used: string;
  required: string;
  tag?: ErrorTag;
  /** Raw number of occurrences in the window. */
  count: number;
  /** Recency-weighted occurrences — what the threshold and the ranking actually use. */
  weight: number;
  /** sentenceIds the learner could re-read to challenge the claim. Capped. */
  evidence: string[];
  /** Library items on the REQUIRED side — whose card should gain the contrast. */
  itemIds: string[];
}

/**
 * How many times a confusion must actually have happened. Below this it is a slip, not a pattern, and
 * a tutor acting on two data points is worse than one with no model at all (plan risk 6).
 */
export const MIN_OCCURRENCES = 3;

/**
 * ...and they must be RECENT enough. Three mistakes spread over a forgotten two months are not a
 * current difficulty; without this floor a pair, once earned, would nag forever.
 */
export const MIN_WEIGHT = 1.5;

/** Older evidence counts for less, halving every this-many days. */
export const HALF_LIFE_DAYS = 21;

/** Evidence is a sample the learner can check, not an archive. */
export const MAX_EVIDENCE = 3;

const DAY_MS = 86_400_000;

function recencyWeight(reviewedAt: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - reviewedAt.getTime()) / DAY_MS);
  return 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

interface Bucket {
  used: string;
  required: string;
  tag?: ErrorTag;
  count: number;
  weight: number;
  newest: number;
  evidence: string[];
  itemIds: Set<string>;
}

/**
 * Aggregate confusion pairs, newest-first, keeping only those that recur AND are still current.
 *
 * Pairs are keyed on the NORMALIZED forms (`lib/normalize.ts`), the same key the coach uses to decide
 * "do you already have this pattern" — otherwise 「〜どころか」 and どころか would be counted as two
 * separate difficulties and neither would ever reach the threshold.
 */
export function minePairs(rows: readonly ConfusionRow[], now: Date): MinedPair[] {
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const w = recencyWeight(row.reviewedAt, now);
    const at = row.reviewedAt.getTime();
    for (const c of row.confusions) {
      const usedKey = normalizeExpression(c.used);
      const requiredKey = normalizeExpression(c.required);
      // A "confusion" of something with itself is a grading artefact, not a signal.
      if (!usedKey || !requiredKey || usedKey === requiredKey) continue;

      const key = `${usedKey}→${requiredKey}`;
      const bucket = buckets.get(key) ?? {
        used: c.used,
        required: c.required,
        tag: c.tag,
        count: 0,
        weight: 0,
        newest: -Infinity,
        evidence: [],
        itemIds: new Set<string>(),
      };
      bucket.count += 1;
      bucket.weight += w;
      // The newest occurrence owns the display forms and the tag — spellings and the grader's reading
      // of the same mistake both drift, and the current one is the one to show.
      if (at > bucket.newest) {
        bucket.newest = at;
        bucket.used = c.used;
        bucket.required = c.required;
        bucket.tag = c.tag;
      }
      if (row.sentenceId && !bucket.evidence.includes(row.sentenceId)) {
        bucket.evidence.push(row.sentenceId);
      }
      // Only link the item when it really IS the required side. The drilled item is usually the one the
      // learner failed to produce, but a SECONDARY item in the same sentence can carry the confusion,
      // and attaching the contrast to the wrong card is worse than attaching it to none.
      if (row.itemId && row.expression && sameExpression(row.expression, c.required)) {
        bucket.itemIds.add(row.itemId);
      }
      buckets.set(key, bucket);
    }
  }

  return [...buckets.values()]
    .filter((b) => b.count >= MIN_OCCURRENCES && b.weight >= MIN_WEIGHT)
    .map((b) => ({
      used: b.used,
      required: b.required,
      ...(b.tag ? { tag: b.tag } : {}),
      count: b.count,
      weight: Math.round(b.weight * 100) / 100,
      evidence: b.evidence.slice(0, MAX_EVIDENCE),
      itemIds: [...b.itemIds],
    }))
    .sort((a, b) => b.weight - a.weight);
}
