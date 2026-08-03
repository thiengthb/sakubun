// Start-progress derivation test (plan 2026-07-25, phase B). Runs against a REAL throwaway SQLite DB
// (same harness as groups.test.ts / tenancy.test.ts) rather than mocking Prisma: the whole point of this
// module is that the flags follow the DATA, so the test has to put real rows in and watch them flip.
// DATABASE_URL is set BEFORE lib/db is imported so the guarded singleton binds to the temp DB.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-progress-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Db = typeof import('@/lib/db');
type GuideProgress = typeof import('@/lib/guide-progress');
let prisma: Db['prisma'];
let GP: GuideProgress;

const FRESH = 'user-fresh';
const BUSY = 'user-busy';

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db'));
  GP = await import('@/lib/guide-progress');

  await prisma.user.create({ data: { id: FRESH, name: FRESH, email: 'fresh@example.test' } });
  await prisma.user.create({ data: { id: BUSY, name: BUSY, email: 'busy@example.test' } });
});

describe('getStartProgress', () => {
  it('a brand-new account has only "signedIn" done', async () => {
    const p = await GP.getStartProgress(FRESH);
    expect(p).toEqual({
      signedIn: true,
      mcpKey: false,
      claudeConnected: false,
      items: false,
      enrichment: false,
      settingsSaved: false,
      firstReview: false,
    });
    expect(GP.countDone(p)).toBe(1);
  });

  it('a created-but-never-used token counts as step 2, NOT step 3', async () => {
    // The distinction the plan's open question was about: having a token != Claude Desktop connected.
    await prisma.mcpKey.create({
      data: { name: 'laptop', tokenHash: 'hash-unused' },
    });
    const p = await GP.getStartProgress(BUSY);
    expect(p.mcpKey).toBe(true);
    expect(p.claudeConnected).toBe(false);
  });

  it('flips claudeConnected once a token has actually been used', async () => {
    await prisma.mcpKey.updateMany({ where: {}, data: { lastUsedAt: new Date() } });
    expect((await GP.getStartProgress(BUSY)).claudeConnected).toBe(true);
  });

  it('separates "has items" from "has an enrichment card"', async () => {
    const plain = await prisma.item.create({
      data: { kind: 'GRAMMAR', expression: '〜ばかりに', meaningVi: 'chỉ vì' },
    });
    let p = await GP.getStartProgress(BUSY);
    expect(p.items).toBe(true);
    expect(p.enrichment).toBe(false);

    await prisma.item.update({
      where: { id: plain.id },
      data: { enrichment: '{"usage":"…"}', enrichedAt: new Date() },
    });
    p = await GP.getStartProgress(BUSY);
    expect(p.enrichment).toBe(true);
  });

  it('settingsSaved follows the Settings row, which only saving creates', async () => {
    const P = await import('@/lib/practice');
    // Reading settings must NOT create a row — otherwise every account would look "configured".
    await P.getSettings(BUSY);
    expect((await GP.getStartProgress(BUSY)).settingsSaved).toBe(false);

    await P.saveSettings(BUSY, { grammarLevels: ['N3'] });
    expect((await GP.getStartProgress(BUSY)).settingsSaved).toBe(true);
  });

  it('firstReview follows the append-only review log', async () => {
    expect((await GP.getStartProgress(BUSY)).firstReview).toBe(false);
    await prisma.reviewLog.create({
      data: {
        rating: 3,
        state: 0,
        due: new Date(),
        stability: 1,
        difficulty: 5,
      },
    });
    const p = await GP.getStartProgress(BUSY);
    expect(p.firstReview).toBe(true);
    expect(GP.countDone(p)).toBe(GP.START_PROGRESS_KEYS.length);
  });

  it('stays per-user: the busy account never leaks into the fresh one', async () => {
    const p = await GP.getStartProgress(FRESH);
    expect(GP.countDone(p)).toBe(1);
  });
});
