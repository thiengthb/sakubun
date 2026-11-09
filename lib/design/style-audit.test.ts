import { describe, expect, it } from 'vitest';
import { judgePage, newFindings, paidDebt, shrinkAuditDebt, type AuditDebt } from './style-audit';

const sample = {
  fontSizes: [14, 17, 17, 15, 12.8, 12],
  gaps: [8, 6, 10, 16, 0, 2],
  smallTargets: ['Xoá 16x16', 'Xoá 16x16', '− 22x22'],
};

describe('style audit (UI v2 U0)', () => {
  it('flags sizes off the type roles, gaps off the 4px grid, small targets', () => {
    expect(judgePage(sample)).toEqual({
      offRoleSizes: [12.8, 15],
      offGridGaps: [2, 6, 10],
      smallTargets: ['Xoá 16x16', '− 22x22'],
    });
  });

  it('a page clean of findings needs no debt', () => {
    const clean = judgePage({ fontSizes: [12, 14, 17, 28], gaps: [4, 8, 24], smallTargets: [] });
    expect(newFindings('/x@1440', clean, {})).toEqual([]);
  });

  it('a finding the debt does not list fails; listed ones pass', () => {
    const found = judgePage(sample);
    const debt: AuditDebt = {
      '/x@1440': { offRoleSizes: [15], offGridGaps: [2, 6, 10], smallTargets: ['Xoá 16x16'] },
    };
    expect(newFindings('/x@1440', found, debt)).toEqual([
      '/x@1440 offRoleSizes: 12.8',
      '/x@1440 smallTargets: − 22x22',
    ]);
  });

  it('debt no longer found is reported, and shrinking never adds', () => {
    const found = judgePage({ fontSizes: [15], gaps: [], smallTargets: ['new 10x10'] });
    const debt: AuditDebt = {
      '/x@1440': { offRoleSizes: [15, 13], offGridGaps: [6], smallTargets: [] },
    };
    expect(paidDebt('/x@1440', found, debt)).toEqual([
      '/x@1440 offRoleSizes: 13',
      '/x@1440 offGridGaps: 6',
    ]);
    expect(shrinkAuditDebt('/x@1440', found, debt)['/x@1440']).toEqual({
      offRoleSizes: [15],
      offGridGaps: [],
      smallTargets: [],
    });
  });
});
