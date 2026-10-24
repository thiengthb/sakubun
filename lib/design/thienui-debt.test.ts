import { describe, expect, it } from 'vitest';

import { countViolations, overDebt, shrinkDebt, staleDebt } from './thienui-debt';

const v = (file: string) => ({ file, line: 1, excerpt: '' });

describe('thienui debt ratchet', () => {
  const found = countViolations([
    { id: 'a', rule: '', violations: [v('x.tsx'), v('x.tsx'), v('y.tsx')] },
    { id: 'b', rule: '', violations: [] },
  ]);

  it('counts violations per rule and file', () => {
    expect(found).toEqual({ a: { 'x.tsx': 2, 'y.tsx': 1 } });
  });

  it('flags a new file and a raised count as over the debt', () => {
    expect(overDebt(found, { a: { 'x.tsx': 1 } })).toEqual([
      { rule: 'a', file: 'x.tsx', allowed: 1, found: 2 },
      { rule: 'a', file: 'y.tsx', allowed: 0, found: 1 },
    ]);
    expect(overDebt(found, { a: { 'x.tsx': 2, 'y.tsx': 1 } })).toEqual([]);
  });

  it('flags debt that was paid off', () => {
    expect(staleDebt(found, { a: { 'x.tsx': 3, 'y.tsx': 1 }, c: { 'z.tsx': 1 } })).toEqual([
      { rule: 'a', file: 'x.tsx', allowed: 3, found: 2 },
      { rule: 'c', file: 'z.tsx', allowed: 1, found: 0 },
    ]);
  });

  it('shrinks the debt but never raises or adds an entry', () => {
    expect(shrinkDebt(found, { a: { 'x.tsx': 3 }, c: { 'z.tsx': 1 } })).toEqual({
      a: { 'x.tsx': 2 },
    });
  });
});
