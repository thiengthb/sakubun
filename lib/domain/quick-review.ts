import type { RatingValue } from '@/lib/srs/srs';

// Quick review on the web is graded by the app, not by an AI: a flip card has two buttons and a
// cloze has one right choice, so each answer maps to exactly one FSRS rating.

export type QuickAnswer =
  { mode: 'flip'; remembered: boolean } | { mode: 'cloze'; correct: boolean };

const AGAIN: RatingValue = 1;
const GOOD: RatingValue = 3;

export function ratingForAnswer(answer: QuickAnswer): RatingValue {
  const passed = answer.mode === 'flip' ? answer.remembered : answer.correct;
  return passed ? GOOD : AGAIN;
}
