import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Roadmap 7.1d: two ways around the learner guard, and where each may appear. Raw SQL is not a model
// operation, so neither the guard nor userDb sees it; the unguarded client skips the guard on purpose.
// A new file on either list needs a reason here.

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCANNED = ['app', 'components', 'hooks', 'lib', 'scripts'];

const RAW_SQL_ALLOWED: Record<string, string> = {
  'lib/db/db.ts': 'defines the guard',
  'lib/db/test-db.ts': 'test helper, clears the learning tables',
  'lib/transfer/import.ts': 'system restore merges the whole database, admin only',
  'app/api/health/route.ts': 'SELECT 1, no table',
};
const UNGUARDED_ALLOWED: Record<string, string> = {
  'lib/db/db.ts': 'defines it',
  'lib/db/user-db.ts': 'userDb builds the per-learner client on it',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'generated' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const files = SCANNED.flatMap((d) => sourceFiles(path.join(ROOT, d))).map((full) => ({
  rel: path.relative(ROOT, full).split(path.sep).join('/'),
  text: readFileSync(full, 'utf8'),
}));

const using = (re: RegExp) => files.filter((f) => re.test(f.text)).map((f) => f.rel);

describe('access around the learner guard', () => {
  it('raw SQL appears only where it is allowed', () => {
    expect(using(/\$(queryRaw|executeRaw)/).filter((f) => !(f in RAW_SQL_ALLOWED))).toEqual([]);
  });

  it('the unguarded client is used only to build userDb', () => {
    expect(using(/\bunguardedPrisma\b/).filter((f) => !(f in UNGUARDED_ALLOWED))).toEqual([]);
  });

  it('the scan sees the files it lists, so a moved file cannot slip past it', () => {
    const scanned = new Set(files.map((f) => f.rel));
    for (const f of [...Object.keys(RAW_SQL_ALLOWED), ...Object.keys(UNGUARDED_ALLOWED)]) {
      expect(scanned.has(f), f).toBe(true);
    }
  });
});
