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

function serverImports(source: string): { statement: string; typeOnly: boolean }[] {
  const found: { statement: string; typeOnly: boolean }[] = [];
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
    expect(existsSync(MOBILE)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
  });

  it('detects a runtime server import when there is one', () => {
    const clean = "import type { AppRouter } from '@/lib/trpc/router';";
    const dirty = "import { appRouter } from '@/lib/trpc/router';";
    const multiline = "import type {\n  AppRouter,\n} from '@/lib/trpc/router';";
    const decoy = "import { z } from 'zod';\nimport type { AppRouter } from '@/lib/trpc/router';";

    expect(serverImports(clean).map((i) => i.typeOnly)).toEqual([true]);
    expect(serverImports(dirty).map((i) => i.typeOnly)).toEqual([false]);
    expect(serverImports(multiline).map((i) => i.typeOnly)).toEqual([true]);
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
