import { describe, expect, it } from 'vitest';
import { composeSpec, directionFor, LENGTH_BY_STEP, PRODUCE_FROM_STEP } from '@/lib/domain/compose';

const BASE = {
  itemLevel: 'N3' as const,
  step: { step: 1 as const, pastCap: 0 },
  learnerLevel: 'N2' as const,
  mode: 'auto' as const,
};

describe('directionFor', () => {
  it('reads Japanese below the produce step and writes it from there, on auto', () => {
    expect(directionFor(1, 'auto')).toBe('JA_VI');
    expect(directionFor(2, 'auto')).toBe('JA_VI');
    expect(directionFor(PRODUCE_FROM_STEP, 'auto')).toBe('VI_JA');
    expect(directionFor(5, 'auto')).toBe('VI_JA');
  });

  it('a fixed mode wins over the step', () => {
    expect(directionFor(1, 'VI_JA')).toBe('VI_JA');
    expect(directionFor(5, 'JA_VI')).toBe('JA_VI');
  });
});

describe('composeSpec', () => {
  it('takes the length and the step from the step', () => {
    for (const step of [1, 2, 3, 4, 5] as const) {
      const spec = composeSpec({ ...BASE, step: { step, pastCap: 0 } });
      expect(spec.step).toBe(step);
      expect(spec.lengthJa).toEqual(LENGTH_BY_STEP[step]);
    }
  });

  it('keeps the words around at the easier of the item’s and the learner’s level', () => {
    expect(composeSpec(BASE).backgroundLevel).toBe('N3');
    expect(composeSpec({ ...BASE, itemLevel: 'N1' }).backgroundLevel).toBe('N2');
    expect(composeSpec({ ...BASE, itemLevel: 'N5' }).backgroundLevel).toBe('N5');
  });

  it('raises the words around to the learner’s level once the item rises past its cap', () => {
    const spec = composeSpec({ ...BASE, itemLevel: 'N5', step: { step: 3, pastCap: 1 } });
    expect(spec.backgroundLevel).toBe('N2');
  });

  it('is polite unless a register is asked for', () => {
    expect(composeSpec(BASE).register).toBe('polite');
    expect(composeSpec({ ...BASE, register: 'honorific' }).register).toBe('honorific');
  });
});
