import { describe, expect, it } from 'vitest';
import { sentenceWords, wordPieces } from './sentence-words';

const tokens = [
  { surface: '駅', reading: 'えき', pos: '名詞' },
  { surface: 'で', pos: '助詞' },
  { surface: '友達', reading: 'ともだち', pos: '名詞' },
  { surface: 'に', pos: '助詞' },
  { surface: '会い', reading: 'あい', base: '会う', pos: '動詞' },
  { surface: 'まし', base: 'ます', pos: '助動詞' },
  { surface: 'た', pos: '助動詞' },
  { surface: '。', pos: '記号' },
];

describe('sentenceWords', () => {
  it('keeps the content words with their offsets and dictionary form', () => {
    expect(sentenceWords('駅で友達に会いました。', tokens)).toEqual([
      { start: 0, end: 1, key: '駅' },
      { start: 2, end: 4, key: '友達' },
      { start: 5, end: 7, key: '会う' },
    ]);
  });

  it('finds a token the tokenizer moved, and skips one it cannot place', () => {
    expect(
      sentenceWords('　駅', [
        { surface: '駅', pos: '名詞' },
        { surface: '猫', pos: '名詞' },
      ]),
    ).toEqual([{ start: 1, end: 2, key: '駅' }]);
  });
});

describe('wordPieces', () => {
  // 会[あ]い as the page draws it: the base 会 in the ruby, い after it.
  const runs = [{ length: 5 }, { length: 1 }, { length: 5 }];

  it('cuts a word at the runs it crosses', () => {
    expect(wordPieces(runs, { start: 5, end: 7, key: '会う' })).toEqual([
      { run: 1, start: 0, end: 1 },
      { run: 2, start: 0, end: 1 },
    ]);
    expect(wordPieces(runs, { start: 2, end: 4, key: '友達' })).toEqual([
      { run: 0, start: 2, end: 4 },
    ]);
  });

  it('drops a word that touches hidden text or runs past the end', () => {
    const hidden = [{ length: 5 }, { length: 1, hidden: true }, { length: 5 }];
    expect(wordPieces(hidden, { start: 5, end: 7, key: '会う' })).toBeNull();
    expect(wordPieces(hidden, { start: 2, end: 4, key: '友達' })).not.toBeNull();
    expect(wordPieces(runs, { start: 10, end: 12, key: 'x' })).toBeNull();
  });
});
