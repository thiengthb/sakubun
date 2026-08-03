import { describe, expect, it } from 'vitest';
import { toRomaji } from '@/lib/romaji';

describe('toRomaji', () => {
  it('romanizes plain hiragana readings', () => {
    expect(toRomaji('たかい')).toBe('takai');
    expect(toRomaji('ながら')).toBe('nagara');
    expect(toRomaji('ともだち')).toBe('tomodachi');
  });

  it('handles youon digraphs and special syllables', () => {
    expect(toRomaji('きょう')).toBe('kyou');
    expect(toRomaji('しゃしん')).toBe('shashin');
    expect(toRomaji('じゅう')).toBe('juu');
  });

  it('geminates small tsu (including tch)', () => {
    expect(toRomaji('きって')).toBe('kitte');
    expect(toRomaji('まっちゃ')).toBe('matcha');
  });

  it('normalizes katakana and the long-vowel mark', () => {
    expect(toRomaji('ネックレス')).toBe('nekkuresu');
    expect(toRomaji('コーヒー')).toBe('koohii');
  });

  it('passes non-kana through so mixed strings still search', () => {
    expect(toRomaji('高いです')).toBe('高idesu');
    expect(toRomaji('')).toBe('');
  });
});
