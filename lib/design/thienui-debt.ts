import type { PatternResult } from '@/tooling/thienui-guards/src/pattern-lock.mjs';

// Pure ratchet logic for the thienui rule debt: compare what the guards find now with the recorded
// debt. No I/O, so it can be tested on its own.

/** rule id -> file -> number of violations still allowed there. */
export type Debt = Record<string, Record<string, number>>;

export function countViolations(results: PatternResult[]): Debt {
  const out: Debt = {};
  for (const r of results) {
    for (const v of r.violations) {
      const byFile = (out[r.id] ??= {});
      byFile[v.file] = (byFile[v.file] ?? 0) + 1;
    }
  }
  return out;
}

export interface Drift {
  rule: string;
  file: string;
  allowed: number;
  found: number;
}

/** Places where there are MORE violations than the debt allows: new breakage. */
export function overDebt(found: Debt, debt: Debt): Drift[] {
  const out: Drift[] = [];
  for (const [rule, files] of Object.entries(found)) {
    for (const [file, n] of Object.entries(files)) {
      const allowed = debt[rule]?.[file] ?? 0;
      if (n > allowed) out.push({ rule, file, allowed, found: n });
    }
  }
  return out;
}

/** Places where the debt allows more than is there now: paid off, so the record must shrink. */
export function staleDebt(found: Debt, debt: Debt): Drift[] {
  const out: Drift[] = [];
  for (const [rule, files] of Object.entries(debt)) {
    for (const [file, allowed] of Object.entries(files)) {
      const n = found[rule]?.[file] ?? 0;
      if (n < allowed) out.push({ rule, file, allowed, found: n });
    }
  }
  return out;
}

/** The debt after paying off what was fixed. Never raises an entry. */
export function shrinkDebt(found: Debt, debt: Debt): Debt {
  const out: Debt = {};
  for (const rule of Object.keys(debt).sort()) {
    for (const file of Object.keys(debt[rule]).sort()) {
      const n = Math.min(debt[rule][file], found[rule]?.[file] ?? 0);
      if (n > 0) (out[rule] ??= {})[file] = n;
    }
  }
  return out;
}
