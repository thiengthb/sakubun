import type { DirectionMode, JlptLevel } from '@/lib/settings/schema';
import { JLPT_LEVELS } from '@/lib/settings/schema';
import { CARD_STATE } from '@/lib/domain/queue';

// How Claude should build the sentence for one item, derived from the item instead of a settings
// form (plan section 9): the FSRS state picks the direction, the item's JLPT level picks the length,
// one level easier while the item is still new. A wish spoken in chat travels as a hint, unsaved.

export type Direction = 'JA_VI' | 'VI_JA';
export type Register = 'casual' | 'polite' | 'honorific' | 'written';

// Stability (days) from which an item counts as known well enough to be produced, not just read.
export const PRODUCE_FROM_STABILITY_DAYS = 21;

// Japanese characters per sentence, by the level the sentence is pitched at.
export const LENGTH_BY_LEVEL: Record<JlptLevel, readonly [number, number]> = {
  N5: [8, 16],
  N4: [12, 22],
  N3: [16, 28],
  N2: [20, 34],
  N1: [26, 42],
};

export interface ComposeInput {
  itemLevel: JlptLevel;
  state: number;
  stability: number;
  learnerLevel: JlptLevel;
  mode: DirectionMode;
  register?: Register | null;
}

export interface ComposeSpec {
  direction: Direction;
  lengthJa: readonly [number, number];
  // Vocabulary around the target stays at or below the learner's level, so the target stands out.
  backgroundLevel: JlptLevel;
  register: Register;
}

// JLPT_LEVELS runs N5 → N1, so "easier" is one index lower.
function easier(level: JlptLevel): JlptLevel {
  return JLPT_LEVELS[Math.max(0, JLPT_LEVELS.indexOf(level) - 1)];
}

export function directionFor(input: Pick<ComposeInput, 'state' | 'stability' | 'mode'>): Direction {
  if (input.mode !== 'auto') return input.mode;
  const known = input.state === CARD_STATE.REVIEW && input.stability >= PRODUCE_FROM_STABILITY_DAYS;
  return known ? 'VI_JA' : 'JA_VI';
}

export function composeSpec(input: ComposeInput): ComposeSpec {
  const stillNew = input.state === CARD_STATE.NEW || input.state === CARD_STATE.LEARNING;
  const pitch = stillNew ? easier(input.itemLevel) : input.itemLevel;
  return {
    direction: directionFor(input),
    lengthJa: LENGTH_BY_LEVEL[pitch],
    backgroundLevel: input.learnerLevel,
    register: input.register ?? 'polite',
  };
}
