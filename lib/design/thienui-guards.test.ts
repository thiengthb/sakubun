import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadRegistry, runPatternLock } from '@/tooling/thienui-guards/src/pattern-lock.mjs';

import { countViolations, overDebt, shrinkDebt, staleDebt, type Debt } from './thienui-debt';

// The thienui design rules (tooling/thienui-guards, vendored from the thienui registry) run here, in
// `npm test`, so CI enforces them. sakubun predates them, so the violations that existed when they
// arrived are recorded in thienui-debt.json. The record only shrinks: a NEW violation fails, and a
// fixed one fails too until the record is lowered, so paid-off debt cannot be spent again.
//
// Contrast and gamut are not run yet: the vendored tokens.json is thienui's theme, not sakubun's
// globals.css (which contrast.test.ts checks). They switch on with the thienui theme.

const DEBT_FILE = 'lib/design/thienui-debt.json';
const LOWER = `UPDATE_THIENUI_DEBT=1 npx vitest run lib/design/thienui-guards.test.ts`;

const registry = loadRegistry('tooling/thienui-guards/ui-patterns.json');
const result = runPatternLock('.', registry);
const found = countViolations(result.byPattern);
const record = JSON.parse(readFileSync(DEBT_FILE, 'utf8')) as { $doc: string; debt: Debt };

if (process.env.UPDATE_THIENUI_DEBT && existsSync(DEBT_FILE)) {
  record.debt = shrinkDebt(found, record.debt);
  writeFileSync(DEBT_FILE, JSON.stringify(record, null, 2) + '\n');
}

describe('thienui design rules', () => {
  it('every rule config is valid', () => {
    const broken = result.byPattern.filter((p) => p.error).map((p) => `${p.id}: ${p.error}`);
    expect(broken).toEqual([]);
  });

  it('no violation beyond the recorded debt', () => {
    const lines = overDebt(found, record.debt).flatMap((d) => {
      const rule = result.byPattern.find((p) => p.id === d.rule)!;
      const where = rule.violations
        .filter((v) => v.file === d.file)
        .map((v) => `    ${v.file}:${v.line}  ${v.excerpt}`);
      return [
        `[${d.rule}] ${d.file}: ${d.found} found, ${d.allowed} allowed. ${rule.rule}`,
        ...where,
      ];
    });
    expect(
      lines,
      'Fix the code to follow the rule (the thienui component usually does it for you). ' +
        'Never add to thienui-debt.json.\n' +
        lines.join('\n'),
    ).toEqual([]);
  });

  it('paid-off debt is removed from the record', () => {
    const lines = staleDebt(found, record.debt).map(
      (d) => `[${d.rule}] ${d.file}: ${d.allowed} allowed, ${d.found} left`,
    );
    expect(
      lines,
      `Good, these were fixed. Lower the record with:\n  ${LOWER}\n${lines.join('\n')}`,
    ).toEqual([]);
  });
});
