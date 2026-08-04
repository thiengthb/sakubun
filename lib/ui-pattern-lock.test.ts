import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Enforces the LOCKED UI PATTERNS registry (`docs/ui-patterns.json`) as a GATE.
 *
 * Why a generic runner instead of another bespoke gate: the three hand-written UI gates
 * (`no-emoji`, `layout-standard`, `spoken-line`) each cost a file of code, so locking a pattern was
 * expensive enough that it mostly did not happen — and the user ended up repeating the same UI
 * correction across sessions. Here a new locked pattern is DATA (one JSON entry), not code, so the
 * marginal cost of locking one is ~2 minutes. Procedure: skill `/ui-pattern-lock`.
 *
 * The three gates above stay as they are: they follow imports / branch on `direction`, which is
 * beyond this runner's two check kinds. This file covers everything expressible as "this must not
 * appear" or "if A appears, B must too".
 *
 * A legitimate exception goes in that pattern's `allow` map WITH a reason — never weaken the check,
 * and never delete an entry (the registry is append-only; retire with `"retired": "<why>"`).
 */

interface Check {
  kind: 'forbid' | 'require-with' | 'manual';
  /** forbid: the pattern that must NOT appear. */
  pattern?: string;
  /** require-with: when this appears in a file... */
  when?: string;
  /** require-with: ...this must appear in the same file. */
  then?: string;
  flags?: string;
}

interface Pattern {
  id: string;
  rule: string;
  why: string;
  canonical: string | null;
  source: string;
  repeats: number;
  lockedOn: string;
  check: Check;
  allow: Record<string, string>;
  /** Roots to scan; defaults to app + components. */
  roots?: string[];
  /** Set when a pattern no longer applies — kept for the record, skipped by the runner. */
  retired?: string;
}

const REGISTRY = 'docs/ui-patterns.json';
const patterns: Pattern[] = JSON.parse(readFileSync(REGISTRY, 'utf8')).patterns;
const live = patterns.filter((p) => !p.retired);

const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (file: string) => relative(process.cwd(), file).split(sep).join('/');

function sources(roots: string[]): { path: string; src: string }[] {
  return roots
    .flatMap((root) => walk(root))
    .map((file) => ({ path: rel(file), src: readFileSync(file, 'utf8') }))
    .filter(({ path }) => !path.endsWith('.test.tsx'));
}

/** The failure message a violation prints — the rule, the why, and where to copy from. */
function explain(p: Pattern, offenders: string[]): string {
  const canonical = p.canonical ? `\nCopy the established shape from: ${p.canonical}` : '';
  return (
    `LOCKED UI PATTERN "${p.id}" (locked ${p.lockedOn}, the user has raised it ${p.repeats}x)\n` +
    `Rule: ${p.rule}\nWhy: ${p.why}${canonical}\n` +
    `A genuine exception goes in this pattern's "allow" map in ${REGISTRY} WITH a reason — do not ` +
    `weaken the check.\nOffenders:\n${offenders.join('\n')}`
  );
}

describe('locked UI patterns (docs/ui-patterns.json)', () => {
  // The registry itself must stay well-formed, otherwise a typo silently disables a lock.
  it('every entry is well-formed', () => {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const p of patterns) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id ?? '')) problems.push(`bad id: ${p.id}`);
      if (seen.has(p.id)) problems.push(`duplicate id: ${p.id}`);
      seen.add(p.id);
      if (!p.rule || !p.why || !p.source) problems.push(`${p.id}: rule/why/source required`);
      const { kind, pattern, when, then } = p.check ?? {};
      if (kind === 'forbid' && !pattern) problems.push(`${p.id}: forbid needs "pattern"`);
      if (kind === 'require-with' && (!when || !then))
        problems.push(`${p.id}: require-with needs "when" and "then"`);
      if (!['forbid', 'require-with', 'manual'].includes(kind))
        problems.push(`${p.id}: unknown check kind "${kind}"`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  // A stale allow-list is how a gate quietly stops gating: the file was renamed or deleted, the
  // exemption stayed, and the next file at that path inherits an unearned pass.
  it('every allow-list entry points at a real file and states a reason', () => {
    const problems: string[] = [];
    for (const p of live) {
      for (const [path, reason] of Object.entries(p.allow ?? {})) {
        if (!existsSync(path)) problems.push(`${p.id}: allow "${path}" no longer exists — drop it`);
        if ((reason ?? '').trim().length < 20)
          problems.push(`${p.id}: allow "${path}" needs a real reason, not "${reason}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  for (const p of live.filter((x) => x.check.kind === 'forbid')) {
    it(`forbid — ${p.id}`, () => {
      const re = new RegExp(p.check.pattern!, p.check.flags ?? '');
      const offenders = sources(p.roots ?? ['app', 'components'])
        .filter(({ path }) => !(p.allow ?? {})[path])
        .filter(({ src }) => re.test(src))
        .map(({ path }) => path);
      expect(offenders, explain(p, offenders)).toEqual([]);
    });
  }

  for (const p of live.filter((x) => x.check.kind === 'require-with')) {
    it(`require-with — ${p.id}`, () => {
      const when = new RegExp(p.check.when!, p.check.flags ?? '');
      const then = new RegExp(p.check.then!, p.check.flags ?? '');
      const offenders = sources(p.roots ?? ['app', 'components'])
        .filter(({ path }) => !(p.allow ?? {})[path])
        .filter(({ src }) => when.test(src) && !then.test(src))
        .map(({ path }) => path);
      expect(offenders, explain(p, offenders)).toEqual([]);
    });
  }

  // `manual` patterns (reuse, coverage, intent) cannot be grepped, so this runner does not check
  // them — they are enforced at write time instead: the PreToolUse hook prints every locked rule
  // before the session's first UI write, and `/ui-pattern-lock check` audits them before a commit.
  // The well-formed test above is what keeps them from rotting into empty entries.
});
