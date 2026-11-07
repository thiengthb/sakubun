import type { JlptLevel } from '@/lib/settings/schema';

// How hard the sentence for one item is (R2, docs/plans/2026-11-07-translation-difficulty.md B):
// a step from 1 to 5 worked out again on every turn from the item's own review history. FSRS still
// decides WHEN an item comes back; the step only decides how hard its sentence is. Pure.
//
// 1. A new item starts at step 1.
// 2. Easy goes up a step.
// 3. Good twice in a row goes up a step; a Good with a hint does not count.
// 4. Hard keeps the step and starts the Good run again.
// 5. Again goes down a step, never below 1.
// 6. The item's level caps the step (N5 at 3, N4 at 4, N3 and up at 5). A rise past the cap is
//    counted instead: from the first one, the words around the item move up to the learner's level.

export type SentenceStep = 1 | 2 | 3 | 4 | 5;

export const STEP_CAP: Record<JlptLevel, SentenceStep> = { N5: 3, N4: 4, N3: 5, N2: 5, N1: 5 };

export interface PastReview {
  rating: number;
  hinted: boolean;
}

export interface StepState {
  step: SentenceStep;
  /** Rises asked for while already at the cap, since the last Again. */
  pastCap: number;
}

/** `reviews` oldest first. */
export function sentenceStep(reviews: readonly PastReview[], level: JlptLevel): StepState {
  const cap = STEP_CAP[level];
  let step = 1;
  let pastCap = 0;
  let goods = 0;
  const rise = () => {
    if (step < cap) step += 1;
    else pastCap += 1;
  };
  for (const { rating, hinted } of reviews) {
    if (rating >= 4) {
      goods = 0;
      rise();
    } else if (rating === 3) {
      if (hinted) continue;
      goods += 1;
      if (goods === 2) {
        goods = 0;
        rise();
      }
    } else if (rating === 2) {
      goods = 0;
    } else {
      goods = 0;
      pastCap = 0;
      step = Math.max(1, step - 1);
    }
  }
  return { step: step as SentenceStep, pastCap };
}
