import { describe, expect, it } from 'vitest';
import { japaneseOf, loosePrefix, scoreGeneration } from '@/lib/generation-score';

const base = {
  direction: 'VI_JA' as const,
  sourceText: 'Vì bác sĩ dặn nên tôi buộc phải nghỉ làm hôm nay.',
  suggested: '医者に言われたので、今日は仕事を休まざるを得ませんでした。',
  sentenceSize: 'medium' as const,
  requestedRegister: 'polite' as const,
  requestedPatterns: ['〜ざるを得ない'],
};

describe('japaneseOf — the direction contract', () => {
  it('reads sourceText under JA_VI and suggested under VI_JA', () => {
    expect(japaneseOf({ direction: 'JA_VI', sourceText: '日本語', suggested: 'tiếng Nhật' })).toBe(
      '日本語',
    );
    expect(japaneseOf({ direction: 'VI_JA', sourceText: 'tiếng Nhật', suggested: '日本語' })).toBe(
      '日本語',
    );
  });

  it('is empty rather than wrong when a VI_JA row has no reference yet', () => {
    expect(japaneseOf({ direction: 'VI_JA', sourceText: 'câu nguồn', suggested: null })).toBe('');
  });
});

describe('pattern usage — a BAND, because the exact match under-counts', () => {
  it('counts a verbatim pattern as exact', () => {
    const s = scoreGeneration(base);
    expect(s.usedExact).toBe(0); // 得ない -> 得ません: the dictionary form is NOT in the sentence
    expect(s.usedLoose).toBe(1); // ...but the stem is, so the pattern WAS used
  });

  it('reports exact when the sentence really does carry the dictionary form', () => {
    const s = scoreGeneration({ ...base, suggested: '行かざるを得ない。' });
    expect(s.usedExact).toBe(1);
    expect(s.usedLoose).toBe(1);
  });

  it('scores a genuinely ignored pattern as zero on BOTH counts', () => {
    const s = scoreGeneration({ ...base, requestedPatterns: ['〜つつある'] });
    expect(s.usedExact).toBe(0);
    expect(s.usedLoose).toBe(0);
  });

  it('strips decoration before matching, so 「〜X」 and X are the same request', () => {
    const s = scoreGeneration({ ...base, requestedPatterns: ['「〜ざるを得ない」'] });
    expect(s.usedLoose).toBe(1);
  });

  it('never shortens a pattern below the minimum prefix', () => {
    expect(loosePrefix('〜ばかり')).toHaveLength(2);
    expect(loosePrefix('〜わけにはいかない')).toBe('わけにはい');
  });

  it('still trims a THREE-character pattern — the floor must not disable the mechanism', () => {
    expect(loosePrefix('〜に限る')).toBe('に限');
    const s = scoreGeneration({
      ...base,
      requestedPatterns: ['〜に限る', '〜かねる'],
      suggested: 'この症状だけでは判断しかねますが、まずは休むに限ります。',
    });
    expect(s.usedExact).toBe(0);
    expect(s.usedLoose).toBe(2);
  });
});

describe('character budget — measured on the SOURCE, per direction', () => {
  it('uses the Vietnamese target under VI_JA', () => {
    const s = scoreGeneration(base);
    expect(s.charTarget).toBe(50);
    expect(s.charActual).toBe([...base.sourceText].length);
  });

  it('uses the Japanese target under JA_VI', () => {
    const s = scoreGeneration({
      ...base,
      direction: 'JA_VI',
      sourceText: '今日は仕事を休まざるを得ませんでした。',
    });
    expect(s.charTarget).toBe(32);
  });

  it('signs the deviation: positive is long', () => {
    const s = scoreGeneration({ ...base, sourceText: 'Ngắn.' });
    expect(s.charDeviation).toBeLessThan(0);
  });
});

describe('register — presence of a polite marker is the only evidence', () => {
  it('matches when polite was asked for and a polite marker is there', () => {
    const s = scoreGeneration(base);
    expect(s.registerObserved).toBe('polite');
    expect(s.registerMatches).toBe(true);
  });

  it('flags a plain sentence when polite was asked for', () => {
    const s = scoreGeneration({ ...base, suggested: '行かざるを得ない。' });
    expect(s.registerObserved).toBe('plain');
    expect(s.registerMatches).toBe(false);
  });

  it('treats casual as satisfied by a plain sentence', () => {
    const s = scoreGeneration({
      ...base,
      requestedRegister: 'casual',
      suggested: '行かざるを得ない。',
    });
    expect(s.registerMatches).toBe(true);
  });

  it('counts `mixed` as always satisfied — it asks for no single register', () => {
    expect(scoreGeneration({ ...base, requestedRegister: 'mixed' }).registerMatches).toBe(true);
  });
});

describe('slot collisions', () => {
  const slots = {
    つまり: 'reformulation-connective',
    要は: 'reformulation-connective',
    '〜ざるを得ない': 'sentence-final-modality',
  };
  const exclusiveSlots = ['reformulation-connective', 'sentence-final-modality'];

  it('is null when no labelling was supplied — absent data must not read as a clean score', () => {
    expect(scoreGeneration(base).slotCollisions).toBeNull();
  });

  it('counts one collision for two occupants of the same exclusive slot', () => {
    const s = scoreGeneration({
      ...base,
      requestedPatterns: ['つまり', '要は', '〜ざるを得ない'],
      slots,
      exclusiveSlots,
    });
    expect(s.slotCollisions).toBe(1);
  });

  it('counts n-1, so three occupants score worse than two', () => {
    const s = scoreGeneration({
      ...base,
      requestedPatterns: ['つまり', '要は', 'すなわち'],
      slots: { ...slots, すなわち: 'reformulation-connective' },
      exclusiveSlots,
    });
    expect(s.slotCollisions).toBe(2);
  });

  it('ignores a slot that is not marked exclusive', () => {
    const s = scoreGeneration({
      ...base,
      requestedPatterns: ['つまり', '要は'],
      slots,
      exclusiveSlots: [],
    });
    expect(s.slotCollisions).toBe(0);
  });
});

describe('the plan step 1.1 acceptance test', () => {
  it('scores identically when applied twice to the same output', () => {
    const input = {
      ...base,
      requestedPatterns: ['〜ざるを得ない', '〜つつある', 'つまり'],
      slots: { つまり: 'reformulation-connective' },
      exclusiveSlots: ['reformulation-connective'],
    };
    expect(scoreGeneration(input)).toEqual(scoreGeneration(input));
  });
});
