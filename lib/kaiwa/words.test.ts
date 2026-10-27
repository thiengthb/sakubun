import { describe, expect, it } from 'vitest';
import type { KaiwaToken } from '@/lib/kaiwa/furigana';
import { groupKeys, lookupKey, lookupKeys, wordGroups } from '@/lib/kaiwa/words';

const t = (surface: string, pos: string, extra: Partial<KaiwaToken> = {}): KaiwaToken => ({
  surface,
  pos,
  ...extra,
});

describe('lookupKey', () => {
  it('looks content words up by their dictionary form and skips particles and punctuation', () => {
    expect(lookupKey(t('会い', '動詞', { base: '会う', reading: 'あ' }))).toBe('会う');
    expect(lookupKey(t('切符', '名詞', { reading: 'きっぷ' }))).toBe('切符');
    expect(lookupKey(t('は', '助詞'))).toBeNull();
    expect(lookupKey(t('ます', '助動詞'))).toBeNull();
    expect(lookupKey(t('。', '記号'))).toBeNull();
    expect(lookupKey(t('10', '名詞'))).toBeNull();
    expect(lookupKey({ surface: '店' })).toBeNull();
  });

  it('lists each key once', () => {
    expect(lookupKeys([t('店', '名詞'), t('の', '助詞'), t('店', '名詞')])).toEqual(['店']);
  });
});

describe('wordGroups', () => {
  it('cuts the line at each word, plain text anywhere', () => {
    const groups = wordGroups('店[みせ]の中[なか]は静[しず]かだった。', [
      t('店', '名詞'),
      t('の', '助詞'),
      t('中', '名詞'),
      t('は', '助詞'),
      t('静か', '名詞'),
      t('だっ', '助動詞'),
      t('た', '助動詞'),
      t('。', '記号'),
    ]);
    expect(groups?.map((g) => [g.length, g.tokens])).toEqual([
      [1, [0]],
      [1, [1]],
      [1, [2]],
      [1, [3]],
      [2, [4]],
      [2, [5]],
      [1, [6]],
      [1, [7]],
    ]);
  });

  it('keeps one reading over several words whole, and one word over several readings whole', () => {
    // The author wrote one reading over 何名様, which the tokenizer cuts in three.
    const over = wordGroups('何名様[なんめいさま]です', [
      t('何', '名詞'),
      t('名', '名詞'),
      t('様', '名詞'),
      t('です', '助動詞'),
    ]);
    expect(over?.map((g) => [g.length, g.tokens])).toEqual([
      [3, [0, 1, 2]],
      [2, [3]],
    ]);
    // 取り消し is one word with two readings.
    const under = wordGroups('取[と]り消[け]し', [t('取り消し', '名詞')]);
    expect(under?.map((g) => [g.length, g.tokens])).toEqual([[4, [0]]]);
  });

  it('gives up when the words do not spell the line', () => {
    expect(wordGroups('店[みせ]', [t('店員', '名詞')])).toBeNull();
    expect(wordGroups('店[みせ]', [])).toBeNull();
  });
});

describe('groupKeys', () => {
  it('tries the whole group before its words, and nothing for a group of particles', () => {
    const tokens = [t('何', '名詞'), t('名', '名詞'), t('様', '名詞'), t('です', '助動詞')];
    const groups = wordGroups('何名様[なんめいさま]です', tokens)!;
    expect(groupKeys(groups[0], tokens)).toEqual(['何名様', '何', '名', '様']);
    expect(groupKeys(groups[1], tokens)).toEqual([]);
  });
});
