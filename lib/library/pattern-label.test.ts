import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { splitPatternLabel } from './pattern-label';

describe('splitPatternLabel', () => {
  it('takes the English label off and gives it in Vietnamese', () => {
    expect(splitPatternLabel('〜が（subject）')).toEqual({ pattern: '〜が', label: 'chủ ngữ' });
    expect(splitPatternLabel('〜に（place of existence）')).toEqual({
      pattern: '〜に',
      label: 'nơi tồn tại',
    });
    expect(splitPatternLabel('〜くする / 〜にする（make）')).toEqual({
      pattern: '〜くする / 〜にする',
      label: 'làm cho',
    });
  });

  it('keeps a Japanese label, a word with no label, and an unknown label as written', () => {
    expect(splitPatternLabel('〜場合（は）')).toEqual({ pattern: '〜場合（は）', label: null });
    expect(splitPatternLabel('〜なしに(は)')).toEqual({ pattern: '〜なしに(は)', label: null });
    expect(splitPatternLabel('会う')).toEqual({ pattern: '会う', label: null });
    expect(splitPatternLabel('〜て（sequence）')).toEqual({ pattern: '〜て', label: 'sequence' });
  });

  it('knows every English label OpenJLPT uses', () => {
    const source = JSON.parse(readFileSync('data/openjlpt/source.json', 'utf8')) as {
      grammar: { expression: string }[];
    };
    const untranslated = source.grammar
      .map((g) => g.expression.match(/[（(]([A-Za-z][A-Za-z /-]*)[）)]\s*$/)?.[1])
      .filter((label): label is string => !!label)
      .filter((label) => splitPatternLabel(`〜（${label}）`).label === label);
    expect(untranslated).toEqual([]);
  });
});
