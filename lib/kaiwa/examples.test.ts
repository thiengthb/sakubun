import { describe, expect, it } from 'vitest';
import { kaiwaExamples, kaiwaLines, MAX_KAIWA_EXAMPLES } from '@/lib/kaiwa/examples';
import { analyzeLines, type KaiwaToken } from '@/lib/kaiwa/furigana';
import { parseScript } from '@/lib/kaiwa/parse';

// Words as the tokenizer would give them, for the lines these tests use.
const WORDS: Record<string, KaiwaToken[]> = {
  '明日駅で会いましょう。': [
    { surface: '明日', reading: 'あした', pos: '名詞' },
    { surface: '駅', reading: 'えき', pos: '名詞' },
    { surface: 'で', pos: '助詞' },
    { surface: '会い', reading: 'あい', base: '会う', pos: '動詞' },
    { surface: 'ましょう', pos: '助動詞' },
    { surface: '。', pos: '記号' },
  ],
  '雨だから、行かない。': [
    { surface: '雨', reading: 'あめ', pos: '名詞' },
    { surface: 'だ', pos: '助動詞' },
    { surface: 'から', pos: '助詞' },
    { surface: '、', pos: '記号' },
    { surface: '行か', reading: 'いか', base: '行く', pos: '動詞' },
    { surface: 'ない', pos: '助動詞' },
    { surface: '。', pos: '記号' },
  ],
};
const tokenize = (text: string) => WORDS[text] ?? [{ surface: text }];

const script = (body: string) => ({
  body,
  analysis: JSON.stringify(analyzeLines(parseScript(body), tokenize)),
});

describe('kaiwaLines', () => {
  it('keeps the translated lines of a script, with their furigana and words', () => {
    const lines = kaiwaLines([
      script('A: 明日駅で会いましょう。 | Mai gặp nhau ở ga nhé.\nB: はい。'),
    ]);
    expect(lines).toEqual([
      {
        ja: '明日駅で会いましょう。',
        vi: 'Mai gặp nhau ở ga nhé.',
        jaRuby: '明日[あした]駅[えき]で会[あ]いましょう。',
        tokens: WORDS['明日駅で会いましょう。'],
      },
    ]);
  });

  it('skips a script whose analysis is missing or stale', () => {
    const body = 'A: 明日駅で会いましょう。 | Mai gặp nhau ở ga nhé.';
    expect(kaiwaLines([{ body, analysis: null }])).toEqual([]);
    expect(
      kaiwaLines([
        { body: `${body}\nB: 雨だから、行かない。 | x`, analysis: script(body).analysis },
      ]),
    ).toEqual([]);
  });
});

describe('kaiwaExamples', () => {
  const lines = kaiwaLines([
    script(
      'A: 明日駅で会いましょう。 | Mai gặp nhau ở ga nhé.\nB: 雨だから、行かない。 | Mưa nên không đi.',
    ),
  ]);

  it('finds a word by its dictionary form and marks the form it takes', () => {
    expect(kaiwaExamples(lines, { kind: 'VOCAB', expression: '会う' })).toEqual([
      {
        ja: '明日駅で会いましょう。',
        vi: 'Mai gặp nhau ở ga nhé.',
        jaRuby: '明日[あした]駅[えき]で会[あ]いましょう。',
        spans: [{ start: 4, end: 6 }],
      },
    ]);
  });

  it('finds a pattern by its text, without its English label', () => {
    const [found] = kaiwaExamples(lines, { kind: 'GRAMMAR', expression: '〜から（reason）' });
    expect(found).toMatchObject({ ja: '雨だから、行かない。', spans: [{ start: 2, end: 4 }] });
  });

  it('leaves out what cannot be placed for sure', () => {
    // One character matches too much; a split pattern is two places.
    expect(kaiwaExamples(lines, { kind: 'GRAMMAR', expression: '〜で' })).toEqual([]);
    expect(kaiwaExamples(lines, { kind: 'GRAMMAR', expression: '〜から〜ない' })).toEqual([]);
    expect(kaiwaExamples(lines, { kind: 'VOCAB', expression: '会議' })).toEqual([]);
  });

  it('takes a few lines per item, each sentence once', () => {
    const many = kaiwaLines(
      Array.from({ length: 5 }, () => script('A: 明日駅で会いましょう。 | Mai gặp nhau ở ga nhé.')),
    );
    expect(kaiwaExamples(many, { kind: 'VOCAB', expression: '会う' })).toHaveLength(1);
    const varied = Array.from({ length: 5 }, (_, i) => ({ ...many[0], ja: `${many[0].ja}${i}` }));
    expect(kaiwaExamples(varied, { kind: 'VOCAB', expression: '会う' })).toHaveLength(
      MAX_KAIWA_EXAMPLES,
    );
  });
});
