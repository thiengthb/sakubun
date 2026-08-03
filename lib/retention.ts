// True retention — what the learner ACTUALLY remembers, versus `settings.desiredRetention` (the
// target FSRS schedules against). The app has always had the target (0.9 by default) and never
// measured the outcome, so a schedule drifting away from reality was invisible.
//
// Definition follows Anki/FSRS convention: count only reviews of cards that were already in the
// Review state, because learning and relearning steps are not memory tests — including them makes
// the number look better than it is. `ReviewLog.state` is the state BEFORE the review (verified in
// ts-fsrs `buildLog`, which reads the pre-review `current`), so `state === 2` is the right filter.
//
// Pure on purpose: every judgement here is unit-tested rather than eyeballed in the browser.

/** FSRS card states, as stored in `ReviewLog.state`. */
export const REVIEW_STATE = 2;

/** A rating of 3 (Good) or 4 (Easy) counts as remembered; 1 (Again) and 2 (Hard) do not. */
const PASS_RATING = 3;

/**
 * Below this many qualifying reviews, a percentage is noise dressed as insight. The card says so
 * instead of drawing a conclusion — the mistake that produced a conjugation table for a field
 * populated on 10 of 200 items.
 */
export const MIN_REVIEWS_FOR_VERDICT = 20;

/** How far from target (in percentage points) still counts as "on schedule". */
export const ON_TARGET_BAND_PTS = 5;

export interface TrueRetention {
  reviews: number; // qualifying reviews (state = Review)
  correct: number; // of those, rating >= 3
  rate: number | null; // 0..1, null when there are no qualifying reviews
}

export type RetentionVerdictKind = 'insufficient' | 'below' | 'on-target' | 'above';

export interface RetentionVerdict {
  kind: RetentionVerdictKind;
  /** Signed gap in percentage points (actual − target). Null when there is no verdict. */
  gapPts: number | null;
  /** Learner-facing Vietnamese reading of the number — what it means, not what it is. */
  message: string;
}

/** Tally qualifying reviews. Rows must already be filtered to `state === REVIEW_STATE`. */
export function computeTrueRetention(rows: readonly { rating: number }[]): TrueRetention {
  const reviews = rows.length;
  const correct = rows.reduce((n, r) => n + (r.rating >= PASS_RATING ? 1 : 0), 0);
  return { reviews, correct, rate: reviews > 0 ? correct / reviews : null };
}

/**
 * Turn the pair (measured, target) into something the learner can act on. `desired` is a 0..1
 * fraction, matching `settings.desiredRetention`.
 */
export function retentionVerdict(actual: TrueRetention, desired: number): RetentionVerdict {
  if (actual.rate === null || actual.reviews < MIN_REVIEWS_FOR_VERDICT) {
    return {
      kind: 'insufficient',
      gapPts: null,
      message: `Chưa đủ dữ liệu để kết luận (cần ${MIN_REVIEWS_FOR_VERDICT} lượt ôn ở trạng thái Ôn tập, hiện có ${actual.reviews}).`,
    };
  }

  const gapPts = Math.round((actual.rate - desired) * 100);

  if (gapPts < -ON_TARGET_BAND_PTS) {
    return {
      kind: 'below',
      gapPts,
      message:
        'Bạn đang quên nhiều hơn mức lịch ôn giả định. Khoảng cách giữa các lần ôn đang quá dài so với trí nhớ thực tế.',
    };
  }
  if (gapPts > ON_TARGET_BAND_PTS) {
    return {
      kind: 'above',
      gapPts,
      message:
        'Bạn nhớ tốt hơn mục tiêu. Có thể hạ mục tiêu ghi nhớ để ôn thưa hơn mà vẫn đạt kỳ vọng, tiết kiệm thời gian.',
    };
  }
  return {
    kind: 'on-target',
    gapPts,
    message: 'Lịch ôn đang khớp với trí nhớ thực tế của bạn.',
  };
}

/**
 * FSRS difficulty (1..10) high enough to watch, even when the item has not lapsed yet. This is a
 * DIFFERENT signal from the existing leech list, which keys on `lapses`: an item can be expensive
 * to hold (difficulty 9.8) while never having been forgotten outright, and the leech list will
 * never surface it.
 */
export const WATCHLIST_DIFFICULTY = 7;
