import { describe, expect, it } from 'vitest';
import { levelsFrom, pickNewItems, type NewCandidate } from '@/lib/domain/new-items';

let n = 0;
const item = (level: string, listed = true, key = `w${n}`): NewCandidate => ({
  id: `${level}-${n++}`,
  level,
  listed,
  createdAt: new Date(2026, 0, 1, 0, n),
  key,
});
const many = (level: string, count: number) =>
  Array.from({ length: count }, (_, i) => item(level, true, `${level}-word-${i}`));
const levelsOf = (ids: string[]) => ids.map((id) => id.split('-')[0]);

describe('levelsFrom', () => {
  it('is the level studied, then the easier ones nearest first', () => {
    expect(levelsFrom('N3')).toEqual(['N3', 'N4', 'N5']);
    expect(levelsFrom('N5')).toEqual(['N5']);
  });
});

describe('pickNewItems', () => {
  const pool = [...many('N5', 20), ...many('N4', 20), ...many('N3', 20), ...many('N2', 20)];

  it('takes three from the level studied, then one from the nearest easier level', () => {
    expect(levelsOf(pickNewItems(pool, 'N3', 0, 8))).toEqual([
      'N3',
      'N3',
      'N3',
      'N4',
      'N3',
      'N3',
      'N3',
      'N4',
    ]);
  });

  it('never takes from a harder level', () => {
    expect(levelsOf(pickNewItems(pool, 'N4', 0, 40))).not.toContain('N3');
    expect(levelsOf(pickNewItems(pool, 'N4', 0, 40))).not.toContain('N2');
  });

  it('keeps the rhythm across days by counting the items already started', () => {
    expect(levelsOf(pickNewItems(pool, 'N3', 3, 2))).toEqual(['N4', 'N3']);
    expect(levelsOf(pickNewItems(pool, 'N3', 5, 3))).toEqual(['N3', 'N3', 'N4']);
  });

  it('moves to the next easier level once the nearest one is done, and fills from either side', () => {
    const thin = [...many('N5', 5), ...many('N3', 2)];
    expect(levelsOf(pickNewItems(thin, 'N3', 0, 6))).toEqual(['N3', 'N3', 'N5', 'N5', 'N5', 'N5']);
    expect(levelsOf(pickNewItems(many('N2', 6), 'N2', 3, 3))).toEqual(['N2', 'N2', 'N2']);
    expect(pickNewItems([], 'N2', 0, 5)).toEqual([]);
  });

  it("puts the learner's own items first, oldest first, then the list in a mixed but fixed order", () => {
    const own = [item('N4', false), item('N4', false)];
    const listed = many('N4', 10);
    const first = pickNewItems([...listed, own[1], own[0]], 'N4', 0, 3);
    expect(first.slice(0, 2)).toEqual([own[0].id, own[1].id]);
    const order = pickNewItems(listed, 'N4', 0, 10);
    expect(pickNewItems([...listed].reverse(), 'N4', 0, 10)).toEqual(order);
    // Not the order the list came in (gojūon for OpenJLPT).
    expect(order).not.toEqual(listed.map((c) => c.id));
  });
});
