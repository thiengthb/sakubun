import type { DirectionMode, JlptLevel } from '@/lib/settings/schema';
import { JLPT_LEVELS } from '@/lib/settings/schema';
import type { StepState } from '@/lib/domain/sentence-step';

// How Claude should build the sentence for one item, derived from the item instead of a settings
// form (plan section 9). Since R2 (docs/plans/2026-11-07-translation-difficulty.md B) the item's
// sentence step (lib/domain/sentence-step.ts) picks the structure, the length and, on auto, the
// direction. A wish spoken in chat travels as a hint, unsaved.

export type Direction = 'JA_VI' | 'VI_JA';
export type Register = 'casual' | 'polite' | 'honorific' | 'written';

// Japanese characters per sentence, by step.
export const LENGTH_BY_STEP: Record<StepState['step'], readonly [number, number]> = {
  1: [8, 16],
  2: [12, 22],
  3: [16, 28],
  4: [20, 34],
  5: [26, 42],
};

// From this step on, auto mode asks the learner to write the Japanese.
export const PRODUCE_FROM_STEP = 3;

export interface ComposeInput {
  itemLevel: JlptLevel;
  step: StepState;
  learnerLevel: JlptLevel;
  mode: DirectionMode;
  register?: Register | null;
}

export interface ComposeSpec {
  step: StepState['step'];
  direction: Direction;
  lengthJa: readonly [number, number];
  // The words around the item stay at or below this level, so the item stands out: the easier of
  // the item's and the learner's, until the item rises past its step cap.
  backgroundLevel: JlptLevel;
  register: Register;
}

// JLPT_LEVELS runs N5 → N1, so the easier of two is the lower index.
function easierOf(a: JlptLevel, b: JlptLevel): JlptLevel {
  return JLPT_LEVELS.indexOf(a) <= JLPT_LEVELS.indexOf(b) ? a : b;
}

export function directionFor(step: StepState['step'], mode: DirectionMode): Direction {
  if (mode !== 'auto') return mode;
  return step >= PRODUCE_FROM_STEP ? 'VI_JA' : 'JA_VI';
}

export function composeSpec(input: ComposeInput): ComposeSpec {
  const { step, pastCap } = input.step;
  return {
    step,
    direction: directionFor(step, input.mode),
    lengthJa: LENGTH_BY_STEP[step],
    backgroundLevel:
      pastCap > 0 ? input.learnerLevel : easierOf(input.itemLevel, input.learnerLevel),
    register: input.register ?? 'polite',
  };
}
