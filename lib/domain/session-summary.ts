import type { RatingValue } from '@/lib/srs/srs';
import { isRemembered } from '@/lib/domain/quick-review';

// U2d (docs/plans/2026-11-13-u2-study-session.md): the summary at the end of a quick review, worked
// out from the session's own answers on the device, so it needs no new query and no schema change.

export interface SessionAnswer {
  itemId: string;
  rating: RatingValue;
  /** A new item met on an intro card: read, not tested, so it is not counted as remembered. */
  intro: boolean;
}

export interface SessionSummary<A extends SessionAnswer> {
  /** Cards that tested the learner: not intros, which were read. "Đã ôn" counts these. */
  tested: number;
  remembered: number;
  /** Share remembered, 0–100, rounded; null when nothing was tested. */
  rate: number | null;
  /** New items met on an intro card. */
  met: number;
  /** The cards worth a second look: the forgotten first, then the hard ones, each item once. */
  toReview: A[];
}

export const TO_REVIEW_MAX = 3;

export function summarizeSession<A extends SessionAnswer>(answers: A[]): SessionSummary<A> {
  const tested = answers.filter((a) => !a.intro);
  const remembered = tested.filter((a) => isRemembered(a.rating)).length;
  const seen = new Set<string>();
  const toReview = [1, 2]
    .flatMap((rating) => tested.filter((a) => a.rating === rating))
    .filter((a) => !seen.has(a.itemId) && seen.add(a.itemId))
    .slice(0, TO_REVIEW_MAX);
  return {
    tested: tested.length,
    remembered,
    rate: tested.length === 0 ? null : Math.round((remembered / tested.length) * 100),
    met: answers.length - tested.length,
    toReview,
  };
}
