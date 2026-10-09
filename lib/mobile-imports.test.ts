// Two invariants about the mobile app that nothing else can catch.
//
// This test lives in the WEB repo's suite on purpose: `mobile/` has no test runner of its own yet, and
// both invariants are about the boundary between the two, not about either side alone. `npm test`
// therefore gates them on every commit, which is the point — a rule enforced only by a paragraph in an
// ADR is a rule that lasts until the first hurried afternoon.
//
// 1. NOTHING RUNTIME CROSSES FROM THE SERVER. The app imports `AppRouter` for its TYPE, through the
//    `@/*` alias. A type import is erased at compile time; a value import of the same module
//    would make Metro follow it into `lib/trpc/router.ts` -> `lib/practice.ts` -> Prisma, and the
//    bundle either explodes or, worse, ships server code to a phone. The failure is silent at the type
//    level (both spellings typecheck), which is exactly why it needs a test.
//
// 2. THE CLIENT HAS NO FSRS ENGINE. `submitReview()` on the server is the only place a schedule is
//    computed (CLAUDE.md). The strongest possible enforcement is that the client CANNOT compute one:
//    no `ts-fsrs` in its dependencies, no copy of it in its source. Then "the client must not schedule"
//    stops being a rule someone has to remember.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MOBILE = 'mobile';
const SKIP_DIRS = new Set(['node_modules', '.expo', 'android', 'ios', 'assets', 'dist']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every `from '@/...'` import statement in a source file, with whether it was `import type`. */
function serverImports(source: string): { statement: string; typeOnly: boolean }[] {
  const found: { statement: string; typeOnly: boolean }[] = [];
  // The clause between `import` and `from` must not contain a quote. That is what stops one match from
  // spanning the PREVIOUS import statement and reporting it as the offender (which is exactly what a
  // lazy `[\s\S]*?` does here). It still spans newlines, so a multi-line named import is matched whole.
  const re = /import\s+(type\s+)?([^;'"]*?)\s*from\s*(['"])([^'"]+)\3/g;
  for (const match of source.matchAll(re)) {
    if (!match[4].startsWith('@/')) continue;
    found.push({ statement: match[0].replace(/\s+/g, ' '), typeOnly: Boolean(match[1]) });
  }
  return found;
}

const files = existsSync(MOBILE) ? walk(MOBILE) : [];

describe('the mobile/server boundary', () => {
  it('has mobile sources to check (the guard is worthless if it silently checks nothing)', () => {
    // Without this, deleting or renaming `mobile/` would turn every assertion below into a green
    // no-op — a test that passes because it found nothing is not a passing test.
    expect(existsSync(MOBILE)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
  });

  it('detects a runtime server import when there is one', () => {
    // The check above is green because the code is clean. This one proves it would go RED otherwise —
    // without it, a broken detector and a clean codebase look identical.
    const clean = "import type { AppRouter } from '@/lib/trpc/router';";
    const dirty = "import { appRouter } from '@/lib/trpc/router';";
    const multiline = "import type {\n  AppRouter,\n} from '@/lib/trpc/router';";
    const decoy = "import { z } from 'zod';\nimport type { AppRouter } from '@/lib/trpc/router';";

    expect(serverImports(clean).map((i) => i.typeOnly)).toEqual([true]);
    expect(serverImports(dirty).map((i) => i.typeOnly)).toEqual([false]);
    expect(serverImports(multiline).map((i) => i.typeOnly)).toEqual([true]);
    // The decoy is the regression that made this detector wrong the first time: a preceding import
    // must not be swallowed into the match and reported as the offender.
    expect(serverImports(decoy).map((i) => i.typeOnly)).toEqual([true]);
    expect(serverImports("import { useState } from 'react';")).toEqual([]);
  });

  it('imports from the server for TYPES only', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const imported of serverImports(source)) {
        if (!imported.typeOnly) offenders.push(`${file}: ${imported.statement}`);
      }
    }
    expect(
      offenders,
      `Import runtime từ server sẽ kéo Prisma vào bundle Metro. Dùng \`import type\`:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('never reaches the server with require() or a dynamic import', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      // Neither form can be erased by the compiler, so neither is ever acceptable across this boundary.
      for (const match of source.matchAll(/(?:require|import)\s*\(\s*['"]@\//g)) {
        offenders.push(`${file}: ${match[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the mobile client cannot schedule', () => {
  it('does not depend on ts-fsrs', () => {
    const pkgPath = join(MOBILE, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(declared)).not.toContain('ts-fsrs');
  });

  it('has no FSRS engine hiding in its source either', () => {
    const offenders = files.filter((file) => /ts-fsrs|\bfsrs\b/i.test(readFileSync(file, 'utf8')));
    expect(
      offenders,
      `submitReview() trên server là lối duy nhất tính lịch — client không được có engine:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
