import { describe, expect, it } from 'vitest';
import { khoTrail, setOfWord } from '@/lib/library/kho-trail';

const labels = (place: Parameters<typeof khoTrail>[0]) => khoTrail(place).map((s) => s.label);

describe('khoTrail (KN1)', () => {
  it('leads a word back up the way it hangs: Kho, the way, its level, its set', () => {
    const steps = khoTrail({ way: 'levels', level: 'N5', kind: 'vocab', set: 3 });
    expect(steps.map((s) => [s.label, s.href])).toEqual([
      ['Kho', '/resources'],
      ['Theo cấp JLPT', '/resources'],
      ['N5 · Từ vựng', '/resources/level/N5/vocab'],
      ['Chặng 3', '/resources/level/N5/vocab/3'],
    ]);
    expect(steps[0].root).toBe(true);
  });

  it('never sends a crumb to the old list of every item for words and patterns', () => {
    for (const place of [
      { way: 'levels', level: 'N2', kind: 'grammar', set: 1 },
      { way: 'outside', source: 'mcp' },
    ] as const)
      for (const step of khoTrail(place)) expect(step.href).not.toMatch(/\/resources\/all|tab=/);
  });

  it('puts an item outside JLPT under its source', () => {
    expect(labels({ way: 'outside', source: 'manual' })).toEqual(['Kho', 'Ngoài JLPT', 'Tự viết']);
    expect(labels({ way: 'outside' })).toEqual(['Kho', 'Ngoài JLPT']);
  });

  it('stops where the place does', () => {
    expect(labels({ way: 'home' })).toEqual(['Kho']);
    expect(labels({ way: 'levels' })).toEqual(['Kho', 'Theo cấp JLPT']);
    expect(labels({ way: 'levels', level: 'N4', kind: 'grammar' })).toEqual([
      'Kho',
      'Theo cấp JLPT',
      'N4 · Ngữ pháp',
    ]);
    expect(labels({ way: 'library' })).toEqual(['Kho', 'Kho chung']);
    expect(khoTrail({ way: 'pending' })[1].pending).toBe(true);
  });
});

describe('setOfWord', () => {
  it('counts sets of `size`, a repeated word where it first appears', () => {
    const words = ['a', 'b', 'a', 'c', 'd', 'e'];
    expect(setOfWord(words, 'a', 2)).toBe(1);
    expect(setOfWord(words, 'c', 2)).toBe(2);
    expect(setOfWord(words, 'd', 2)).toBe(2);
    expect(setOfWord(words, 'e', 2)).toBe(3);
    expect(setOfWord(words, 'z', 2)).toBeNull();
  });
});
