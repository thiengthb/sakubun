// "Easy" has to be EARNED — a server-side floor on the one rating the tutor over-gives.
//
// The learner's report (2026-07-28): in quiz mode a correct answer was essentially always graded
// 4 Easy. That is not a cosmetic problem. Easy is the strongest possible signal to FSRS — it stretches
// the next interval hardest — so a loop that hands it out for every correct pick teaches the scheduler
// that everything is mastered, and the learner ends up depending on a drill that has stopped
// challenging them. They named this exact risk: "cứ đúng là easy thì người dùng sẽ bị phụ thuộc xấu".
//
// Asking the model to be stricter is not a fix; the protocol ALREADY said "when torn, go lower" and it
// still happened. So the floor lives in code, on the FSRS write path, using two signals the server can
// actually see:
//
//   - ELAPSED TIME between stage_sentence (question shown) and submit_review (answer graded). Recall
//     speed is the classic proxy for strength, and unlike "did it feel easy" it is observable.
//   - ASSISTS the tutor reports for the turn: a hint given, or the learner asking what a word means
//     before answering. An answer that needed help is by definition not effortless.
//
// The guard only ever moves a rating DOWN, and only from Easy. That asymmetry is deliberate: a long gap
// may just mean the learner walked away mid-question, which is fine evidence against "effortless" and
// terrible evidence for "hard". Downgrading Easy to Good on an away-from-keyboard turn costs a slightly
// shorter interval; upgrading anything on a timer would corrupt real recall data.

export type Rating = 1 | 2 | 3 | 4;

/**
 * Answer within this many seconds to still qualify for Easy — PER EXERCISE TYPE, because a single
 * constant is wrong in both directions at once.
 *
 * These are not intuitions. They are the 25th percentile of this learner's own recorded answer times
 * (`answeredAt - createdAt`, 2026-07-28): QUIZ n=25 → p25 24s, median 30s, p90 48s; TRANSLATION n=72 →
 * p25 104s, median 167s, p90 332s. The guard originally shipped with a flat 120s, which sat ABOVE
 * quiz's p90 (so it could essentially never fire on the very loop that prompted it) and BELOW
 * translation's p25 (so it would have downgraded most correct translations). Picking p25 keeps Easy
 * available to roughly the fastest quarter, which is about how often "effortless" should be true.
 *
 * Re-derive these when there is more history — `SELECT (julianday(answeredAt)-julianday(createdAt))*86400`
 * grouped by exerciseType. A threshold nobody re-measures drifts into decoration.
 */
export const EASY_MAX_SECONDS: Record<string, number> = {
  QUIZ: 25,
  TRANSLATION: 100,
  CONVERSATION: 120, // n=1 (237s); provisional, treated like translation until there is real data
};

/** Used for an exercise type with no measured history yet — deliberately lenient, so an unmeasured
 * loop is never taxed by a number that was guessed for it. */
export const EASY_MAX_SECONDS_DEFAULT = 120;

export function easyCeilingFor(exerciseType: string | null | undefined): number {
  return EASY_MAX_SECONDS[exerciseType ?? ''] ?? EASY_MAX_SECONDS_DEFAULT;
}

export type RatingEvidence = {
  /** Seconds from question shown to answer graded; null when it cannot be computed. */
  elapsedSec: number | null;
  /** Hints given / meaning questions asked before answering, as reported by the tutor. */
  assists: number;
  /** Which loop this was — the ceiling differs by an order of magnitude between quiz and translation. */
  exerciseType?: string | null;
};

export type RatingVerdict = {
  rating: Rating;
  /** Set only when the claim was lowered — surfaced to the learner so the grade is never mysterious. */
  downgradedFrom?: Rating;
  reason?: string;
};

/**
 * Apply the Easy floor to a rating the tutor proposed. Everything except a claim of 4 passes through
 * untouched — Again/Hard/Good are judgements about correctness and fluency that only the tutor can make.
 */
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

  // An unmeasurable elapsed time is NOT treated as failing the check. The guard exists to catch the
  // over-given Easy, not to withhold a legitimate one whenever a timestamp is missing.
  return { rating: 4 };
}
