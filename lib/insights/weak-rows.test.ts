import { describe, expect, it } from 'vitest';

import { mergeWeakRows } from '@/lib/insights/weak-rows';

describe('mergeWeakRows', () => {
  it('puts each reason of one pattern on the same row', () => {
    const rows = mergeWeakRows([
      { reason: 'misses', entries: [{ key: 'a', text: 'A', href: '/a', n: 3 }] },
      { reason: 'lapses', entries: [{ key: 'a', text: 'A', href: '/a', n: 5 }] },
      { reason: 'hard', entries: [{ key: 'a', text: 'A', href: '/a', n: 8.2 }] },
    ]);
    expect(rows).toEqual([{ key: 'a', text: 'A', href: '/a', misses: 3, lapses: 5, hard: 8.2 }]);
  });

  it('leaves a reason the pattern does not have empty, not zero', () => {
    const [row] = mergeWeakRows([{ reason: 'hard', entries: [{ key: 'a', text: 'A', n: 7 }] }]);
    expect(row.misses).toBeUndefined();
    expect(row.lapses).toBeUndefined();
  });

  it('ranks a lapse twice a miss, then breaks ties on difficulty', () => {
    const rows = mergeWeakRows([
      {
        reason: 'misses',
        entries: [
          { key: 'missed3', text: 'm', n: 3 },
          { key: 'tieHard', text: 't', n: 3 },
        ],
      },
      { reason: 'lapses', entries: [{ key: 'lapsed2', text: 'l', n: 2 }] },
      {
        reason: 'hard',
        entries: [
          { key: 'tieHard', text: 't', n: 9 },
          { key: 'onlyHard', text: 'o', n: 9.5 },
        ],
      },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['lapsed2', 'tieHard', 'missed3', 'onlyHard']);
  });
});
