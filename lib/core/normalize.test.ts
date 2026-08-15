import { describe, expect, it } from 'vitest';
import { normalizeExpression, sameExpression } from '@/lib/core/normalize';

describe('normalizeExpression — the difference between "you have this" and a duplicate', () => {
  it('collapses every tilde/wave-dash spelling of the same pattern', () => {
    const forms = [
      '〜わけにはいかない',
      '～わけにはいかない',
      '~わけにはいかない',
      'わけにはいかない',
      '…わけにはいかない',
      '・わけにはいかない',
      '  〜わけにはいかない  ',
    ];
    const keys = new Set(forms.map(normalizeExpression));
    expect(keys.size).toBe(1);
  });

  it('strips the quoting Claude adds when it repeats a pattern back', () => {
    expect(sameExpression('「〜ばかりに」', '〜ばかりに')).toBe(true);
    expect(sameExpression('『ばかりに』', 'ばかりに')).toBe(true);
    expect(sameExpression('"ばかりに"', 'ばかりに')).toBe(true);
    expect(sameExpression('（ばかりに）', 'ばかりに')).toBe(true);
  });

  it('NFKC-folds full-width ASCII so a pasted form matches a typed one', () => {
    expect(sameExpression('ＡＢＣ', 'abc')).toBe(true);
    expect(sameExpression('Ｎ３', 'n3')).toBe(true);
  });

  it('does NOT collapse two genuinely different patterns', () => {
    expect(sameExpression('〜ばかりに', '〜ばかりで')).toBe(false);
    expect(sameExpression('〜たら', '〜なら')).toBe(false);
  });

  it('a trailing tilde is stripped too (both attachment marks)', () => {
    expect(sameExpression('ばかりに〜', 'ばかりに')).toBe(true);
  });
});
