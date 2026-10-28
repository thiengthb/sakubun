import { describe, expect, it } from 'vitest';
import type { KaiwaToken } from '@/lib/kaiwa/furigana';
import { lookupKey, lookupKeys } from '@/lib/kaiwa/words';

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
