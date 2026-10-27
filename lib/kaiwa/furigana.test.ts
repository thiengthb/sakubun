import { describe, expect, it } from 'vitest';
import {
  analyzeLines,
  readAnalysis,
  rubyFromTokens,
  toHiragana,
  wordRuby,
  type KaiwaToken,
} from '@/lib/kaiwa/furigana';
import { parseScript } from '@/lib/kaiwa/parse';

describe('wordRuby', () => {
  it('keeps the kana a word is written with outside the brackets', () => {
    expect(wordRuby('静か', 'しずか')).toBe('静[しず]か');
    expect(wordRuby('取り消し', 'とりけし')).toBe('取[と]り消[け]し');
    expect(wordRuby('お茶', 'おちゃ')).toBe('お茶[ちゃ]');
  });

  it('gives a kanji-only word the whole reading', () => {
    expect(wordRuby('日本語', 'にほんご')).toBe('日本語[にほんご]');
  });

  it('reads katakana in the word as its hiragana', () => {
    expect(wordRuby('日本テレビ', 'にほんてれび')).toBe('日本[にほん]テレビ');
  });

  it('falls back to the whole word when the kana do not line up', () => {
    expect(wordRuby('取り消し', 'きゃんせる')).toBe('取り消し[きゃんせる]');
  });

  it('leaves a word without kanji alone', () => {
    expect(wordRuby('です', 'です')).toBe('です');
  });
});

describe('rubyFromTokens', () => {
  it('joins the words, and fences a kanji word with no reading so the next reading stays its own', () => {
    const tokens: KaiwaToken[] = [
      { surface: '田中', reading: 'たなか' },
      { surface: 'さん' },
      { surface: '某所' },
      { surface: '学校', reading: 'がっこう' },
    ];
    expect(rubyFromTokens(tokens)).toBe('田中[たなか]さん某所[]学校[がっこう]');
  });
});

describe('toHiragana', () => {
  it('turns katakana into hiragana and leaves the rest', () => {
    expect(toHiragana('ナンメイサマ, ok')).toBe('なんめいさま, ok');
  });
});

describe('analyzeLines', () => {
  const tokenize = (text: string): KaiwaToken[] =>
    text === '二人です。'
      ? [{ surface: '二人', reading: 'ふたり' }, { surface: 'です' }, { surface: '。' }]
      : [{ surface: text }];

  it('adds readings, but keeps the furigana an author wrote', () => {
    const lines = parseScript('A: 二人です。 | Hai người.\nB: 料理[りょうり]です。');
    const analysis = analyzeLines(lines, tokenize);
    expect(analysis.lines.map((l) => l.ruby)).toEqual([
      '二人[ふたり]です。',
      '料理[りょうり]です。',
    ]);
    // Words are always from the plain text, for the lookup.
    expect(analysis.lines[1].tokens).toEqual([{ surface: '料理です。' }]);
  });
});

describe('readAnalysis', () => {
  it('takes only an analysis of this version for the same number of lines', () => {
    const ok = JSON.stringify({ v: 1, lines: [{ ruby: 'は', tokens: [] }] });
    expect(readAnalysis(ok, 1)?.lines).toHaveLength(1);
    expect(readAnalysis(ok, 2)).toBeNull();
    expect(readAnalysis(JSON.stringify({ v: 2, lines: [] }), 0)).toBeNull();
    expect(readAnalysis('not json', 1)).toBeNull();
    expect(readAnalysis(null, 1)).toBeNull();
  });
});
