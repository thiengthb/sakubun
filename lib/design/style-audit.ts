// UI v2 phase U0 (docs/plans/2026-11-08-ui-v2.md › Hiện trạng): what e2e/style-audit.spec.ts measures in
// the browser, judged here without a browser. Three numbers per page: font sizes that are not a type
// role, flex/grid gaps off the 4px grid, and things to press smaller than 24×24px (WCAG 2.2, 2.5.8).
// Pages built before the roles keep theirs in e2e/style-audit-debt.json, a list that only shrinks.

/** Every size a type role draws at, in px (app/globals.css › Type roles). */
export const ROLE_SIZES = [
  12, // caption, text-xs
  14, // ui, text-sm
  17, // body and heading, text-body
  20, // title, phone
  28, // title, laptop
  34, // display
  18, // jp-body
  24, // jp-title, phone
  32, // jp-hero, phone
  40, // jp-hero, laptop
] as const;

export interface PageSample {
  /** Computed font sizes of elements that hold text directly, furigana readings left out. */
  fontSizes: number[];
  /** Computed row and column gaps of flex and grid boxes, in px. */
  gaps: number[];
  /** Pressable things under 24px on a side: "label WxH". */
  smallTargets: string[];
}

export interface PageFindings {
  offRoleSizes: number[];
  offGridGaps: number[];
  smallTargets: string[];
}

const uniqSorted = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
const round = (n: number) => Math.round(n * 100) / 100;

export function judgePage(sample: PageSample): PageFindings {
  const roles = new Set<number>(ROLE_SIZES);
  return {
    offRoleSizes: uniqSorted(sample.fontSizes.map(round).filter((s) => !roles.has(s))),
    offGridGaps: uniqSorted(sample.gaps.map(round).filter((g) => g > 0 && g % 4 !== 0)),
    smallTargets: [...new Set(sample.smallTargets)].sort(),
  };
}

export type AuditDebt = Record<string, PageFindings>;

const KEYS = ['offRoleSizes', 'offGridGaps', 'smallTargets'] as const;

/** Findings a page has that its debt does not list: these fail the audit. */
export function newFindings(page: string, found: PageFindings, debt: AuditDebt): string[] {
  const owed = debt[page];
  const out: string[] = [];
  for (const key of KEYS) {
    const allowed = new Set<string | number>(owed?.[key] ?? []);
    for (const v of found[key] as (string | number)[])
      if (!allowed.has(v)) out.push(`${page} ${key}: ${v}`);
  }
  return out;
}

/** Debt entries a page no longer has: the list must be lowered so they cannot come back. */
export function paidDebt(page: string, found: PageFindings, debt: AuditDebt): string[] {
  const owed = debt[page];
  if (!owed) return [];
  const out: string[] = [];
  for (const key of KEYS) {
    const now = new Set<string | number>(found[key] as (string | number)[]);
    for (const v of owed[key] as (string | number)[])
      if (!now.has(v)) out.push(`${page} ${key}: ${v}`);
  }
  return out;
}

/** The debt lowered to what is still found. It never adds: a new finding stays a failure. */
export function shrinkAuditDebt(page: string, found: PageFindings, debt: AuditDebt): AuditDebt {
  const owed = debt[page];
  if (!owed) return debt;
  const keep = <T extends string | number>(list: T[], now: T[]) => {
    const n = new Set<T>(now);
    return list.filter((v) => n.has(v));
  };
  return {
    ...debt,
    [page]: {
      offRoleSizes: keep(owed.offRoleSizes, found.offRoleSizes),
      offGridGaps: keep(owed.offGridGaps, found.offGridGaps),
      smallTargets: keep(owed.smallTargets, found.smallTargets),
    },
  };
}
