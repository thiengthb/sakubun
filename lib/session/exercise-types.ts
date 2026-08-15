export const EXERCISE_TYPES = [
  'TRANSLATION',
  'CLOZE',
  'DIALOGUE',
  'QUIZ',
  'CONVERSATION',
  'CLOZE_PRODUCTION',
  'GUIDED_PRODUCTION',
  'TEACH_BACK',
] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];
