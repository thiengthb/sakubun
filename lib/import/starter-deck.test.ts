import { describe, expect, it } from 'vitest';
import { loadStarterDeck } from './starter-deck';

describe('loadStarterDeck', () => {
  it('kho dựng từ data/openjlpt có cả ngữ pháp lẫn từ vựng, đã có nghĩa tiếng Việt', async () => {
    const full = await loadStarterDeck();
    expect(full.length).toBeGreaterThan(7000);
    expect(new Set(full.map((i) => i.kind))).toEqual(new Set(['GRAMMAR', 'VOCAB']));
    expect(full.every((i) => i.meaningVi && i.source === 'OPENJLPT')).toBe(true);
  });
});
