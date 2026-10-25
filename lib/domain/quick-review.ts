import type { RatingValue } from '@/lib/srs/srs';

// Quick review on the web is graded by the app, not by an AI: a flip card has the four FSRS buttons
// (decision 0005) and a cloze has one right choice, so each answer maps to exactly one FSRS rating.

export type QuickAnswer =
  { mode: 'flip'; rating: RatingValue } | { mode: 'cloze'; correct: boolean };

export const RATINGS: readonly RatingValue[] = [1, 2, 3, 4];

const AGAIN: RatingValue = 1;
const GOOD: RatingValue = 3;

export function ratingForAnswer(answer: QuickAnswer): RatingValue {
  if (answer.mode === 'flip') return answer.rating;
  return answer.correct ? GOOD : AGAIN;
}

/** Remembered as the retention figures count it (lib/srs/retention.ts): Good or Easy. */
export function isRemembered(rating: RatingValue): boolean {
  return rating >= GOOD;
}
