export type Rating = 1 | 2 | 3 | 4;

export const EASY_MAX_SECONDS: Record<string, number> = {
  QUIZ: 25,
  TRANSLATION: 100,
  CONVERSATION: 120, // n=1 (237s); provisional, treated like translation until there is real data
};

export const EASY_MAX_SECONDS_DEFAULT = 120;

export function easyCeilingFor(exerciseType: string | null | undefined): number {
  return EASY_MAX_SECONDS[exerciseType ?? ''] ?? EASY_MAX_SECONDS_DEFAULT;
}

export type RatingEvidence = {
  elapsedSec: number | null;
  assists: number;
  exerciseType?: string | null;
};

export type RatingVerdict = {
  rating: Rating;
  downgradedFrom?: Rating;
  reason?: string;
};

export function earnedRating(claimed: Rating, evidence: RatingEvidence): RatingVerdict {
  if (claimed !== 4) return { rating: claimed };

  const assists = Number.isFinite(evidence.assists) ? Math.max(0, Math.trunc(evidence.assists)) : 0;
  if (assists > 0) {
    return {
      rating: 3,
      downgradedFrom: 4,
      reason: `cần ${assists} gợi ý/hỏi thêm nên tính là Good, không phải Easy`,
    };
  }

  const { elapsedSec } = evidence;
  const ceiling = easyCeilingFor(evidence.exerciseType);
  if (elapsedSec !== null && Number.isFinite(elapsedSec) && elapsedSec > ceiling) {
    return {
      rating: 3,
      downgradedFrom: 4,
      reason: `mất ${Math.round(elapsedSec)}s (quá ${ceiling}s) nên tính là Good, không phải Easy`,
    };
  }

  return { rating: 4 };
}
