import { describe, expect, it } from 'vitest';
import { estimateTokens } from '@/lib/mcp/token-estimate';

describe('estimateTokens', () => {
  it('counts ASCII at about four characters per token', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('counts each kana and kanji as one token', () => {
    expect(estimateTokens('約束する')).toBe(4);
  });

  it('counts Vietnamese diacritics at about two characters per token', () => {
    // "hứa" = h, a (ASCII) + ứ (other): 2/4 + 1/2 = 1
    expect(estimateTokens('hứa')).toBe(1);
  });
});
