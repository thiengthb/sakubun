export const REVIEW_STATE = 2;

const PASS_RATING = 3;

export const MIN_REVIEWS_FOR_VERDICT = 20;

export const ON_TARGET_BAND_PTS = 5;

export interface TrueRetention {
  reviews: number; // qualifying reviews (state = Review)
  correct: number; // of those, rating >= 3
  rate: number | null; // 0..1, null when there are no qualifying reviews
}

export type RetentionVerdictKind = 'insufficient' | 'below' | 'on-target' | 'above';

export interface RetentionVerdict {
  kind: RetentionVerdictKind;
  gapPts: number | null;
  message: string;
}

export function computeTrueRetention(rows: readonly { rating: number }[]): TrueRetention {
  const reviews = rows.length;
  const correct = rows.reduce((n, r) => n + (r.rating >= PASS_RATING ? 1 : 0), 0);
  return { reviews, correct, rate: reviews > 0 ? correct / reviews : null };
}

export function retentionVerdict(actual: TrueRetention, desired: number): RetentionVerdict {
  if (actual.rate === null || actual.reviews < MIN_REVIEWS_FOR_VERDICT) {
    return {
      kind: 'insufficient',
      gapPts: null,
      message: `Còn ${MIN_REVIEWS_FOR_VERDICT - actual.reviews} lượt nữa mới kết luận được (cần ${MIN_REVIEWS_FOR_VERDICT} lượt ôn ở trạng thái Ôn tập, hiện có ${actual.reviews}).`,
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

export const WATCHLIST_DIFFICULTY = 7;
