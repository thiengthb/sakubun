import { describe, expect, it } from 'vitest';
import { countOwned } from './progress';

describe('countOwned', () => {
  const members = [
    { groupEntryId: 'g1', type: 'GRAMMAR', expression: '〜は' },
    { groupEntryId: 'g1', type: 'GRAMMAR', expression: '〜が' },
    { groupEntryId: 'g1', type: 'GRAMMAR', expression: null },
    { groupEntryId: 'g2', type: 'VOCAB', expression: '駅' },
  ];

  it('counts the members the learner has, by kind and expression', () => {
    const counts = countOwned(members, [
      { kind: 'GRAMMAR', expression: '〜は' },
      { kind: 'VOCAB', expression: '駅' },
    ]);
    expect(counts).toEqual(
      new Map([
        ['g1', 1],
        ['g2', 1],
      ]),
    );
  });

  it('gives every group a count, zero when the learner has none of it', () => {
    expect(countOwned(members, [])).toEqual(
      new Map([
        ['g1', 0],
        ['g2', 0],
      ]),
    );
  });

  it('does not count the same expression of another kind', () => {
    expect(countOwned(members, [{ kind: 'VOCAB', expression: '〜は' }]).get('g1')).toBe(0);
  });
});
