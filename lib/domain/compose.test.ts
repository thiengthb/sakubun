import { describe, expect, it } from 'vitest';
import {
  composeSpec,
  directionFor,
  LENGTH_BY_LEVEL,
  PRODUCE_FROM_STABILITY_DAYS,
} from '@/lib/domain/compose';
import { CARD_STATE } from '@/lib/domain/queue';

const BASE = {
  itemLevel: 'N2',
  state: CARD_STATE.REVIEW,
  stability: 40,
  learnerLevel: 'N3',
  mode: 'auto',
} as const;

describe('directionFor', () => {
  it('auto: an item still being learned is read (Japanese to Vietnamese)', () => {
    for (const state of [CARD_STATE.NEW, CARD_STATE.LEARNING, CARD_STATE.RELEARNING]) {
      expect(directionFor({ ...BASE, state })).toBe('JA_VI');
    }
  });

  it('auto: a review item becomes produced (Vietnamese to Japanese) once stable', () => {
    expect(directionFor({ ...BASE, stability: PRODUCE_FROM_STABILITY_DAYS - 1 })).toBe('JA_VI');
    expect(directionFor({ ...BASE, stability: PRODUCE_FROM_STABILITY_DAYS })).toBe('VI_JA');
  });

  it('a fixed mode wins over the item state', () => {
    expect(directionFor({ ...BASE, state: CARD_STATE.NEW, mode: 'VI_JA' })).toBe('VI_JA');
    expect(directionFor({ ...BASE, mode: 'JA_VI' })).toBe('JA_VI');
  });
});

describe('composeSpec', () => {
  it('pitches a known item at its own level', () => {
    expect(composeSpec(BASE).lengthJa).toEqual(LENGTH_BY_LEVEL.N2);
  });

  it('pitches a new item one level easier, and N5 stays N5', () => {
    expect(composeSpec({ ...BASE, state: CARD_STATE.NEW }).lengthJa).toEqual(LENGTH_BY_LEVEL.N3);
    expect(composeSpec({ ...BASE, itemLevel: 'N5', state: CARD_STATE.NEW }).lengthJa).toEqual(
      LENGTH_BY_LEVEL.N5,
    );
  });

  it('keeps background vocabulary at the learner level and defaults to polite', () => {
    const spec = composeSpec(BASE);
    expect(spec.backgroundLevel).toBe('N3');
    expect(spec.register).toBe('polite');
    expect(composeSpec({ ...BASE, register: 'honorific' }).register).toBe('honorific');
  });
});
