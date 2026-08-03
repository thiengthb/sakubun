// Cross-user isolation test (plan 2026-07-21, step 2.5). Proves the multi-tenancy boundary end to
// end against a REAL SQLite database: user A can never read or mutate user B's data through the
// lib/practice.ts choke point, and the fail-closed guard (lib/db.ts) rejects any query that forgets
// its userId scope. This is the one DB-backed test in the suite; it spins up a throwaway database
// via `prisma db push` and points the guarded client at it (DATABASE_URL is set BEFORE lib/db is
// imported, so the singleton binds to the temp DB, not dev.db).

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..'); // lib/ -> sakubun root
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-tenancy-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot, // so the schema + prisma.config.ts resolve no matter where vitest was invoked
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

// Imported AFTER DATABASE_URL is set so the guarded singleton opens the temp DB.
type Practice = typeof import('@/lib/practice');
type Db = typeof import('@/lib/db');
let P: Practice;
let prisma: Db['prisma'];

const USER_A = 'user-a';
const USER_B = 'user-b';

async function makeUser(id: string): Promise<void> {
  await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
}

beforeAll(async () => {
  P = await import('@/lib/practice');
  ({ prisma } = await import('@/lib/db'));
  await makeUser(USER_A);
  await makeUser(USER_B);
});

describe('multi-tenancy isolation', () => {
  it('the fail-closed guard rejects a user-owned query with no userId scope', async () => {
    await expect(prisma.item.findMany({})).rejects.toThrow(/Tenancy guard/);
    await expect(prisma.srsState.count({ where: {} })).rejects.toThrow(/Tenancy guard/);
  });

  it('settings are per-user: B sees defaults, never A saved values', async () => {
    const bDefault = (await P.getSettings(USER_B)).dailyNewGrammar;
    const target = bDefault === 3 ? 5 : 3; // a valid, in-range value distinct from B's default
    await P.saveSettings(USER_A, { dailyNewGrammar: target });
    expect((await P.getSettings(USER_A)).dailyNewGrammar).toBe(target);
    expect((await P.getSettings(USER_B)).dailyNewGrammar).toBe(bDefault); // B untouched
  });

  it('a SECOND user can save settings — no primary-key collision (id is autoincrement)', async () => {
    // Regression for the old `Settings.id @default(1)`: A's create took id=1, so B's create collided on
    // the PK and threw (a 2nd user could never save settings). With autoincrement both persist.
    await P.saveSettings(USER_A, { dailyNewGrammar: 4 });
    await P.saveSettings(USER_B, { dailyNewGrammar: 2 });
    expect((await P.getSettings(USER_A)).dailyNewGrammar).toBe(4);
    expect((await P.getSettings(USER_B)).dailyNewGrammar).toBe(2);

    // Two distinct rows now exist (queried per-user so the tenancy guard is satisfied).
    const aRow = await prisma.settings.findUnique({ where: { userId: USER_A } });
    const bRow = await prisma.settings.findUnique({ where: { userId: USER_B } });
    expect(aRow!.id).not.toBe(bRow!.id);
  });

  it('items are isolated: each user only ever lists their own', async () => {
    await P.addItems(USER_A, [{ expression: 'AAA_pattern', meaningVi: 'của A' }]);
    await P.addItems(USER_B, [{ expression: 'BBB_pattern', meaningVi: 'của B' }]);

    const aList = await P.listItems(USER_A);
    const bList = await P.listItems(USER_B);
    expect(aList.map((i) => i.expression)).toEqual(['AAA_pattern']);
    expect(bList.map((i) => i.expression)).toEqual(['BBB_pattern']);
  });

  it("B cannot grade A's staged sentence, delete A's item, or touch A's schedule", async () => {
    const [aItem] = await P.listItems(USER_A);
    const { sentenceId } = await P.stageSentence(USER_A, {
      direction: 'JA_VI',
      sourceText: '文A',
      suggested: 'câu A',
      items: [{ itemId: aItem.itemId, role: 'TARGET' }],
    });

    // Grading it AS B: the sentence is not found in B's tenant → rejected, A's schedule untouched.
    await expect(
      P.submitReview(USER_B, {
        sentenceId,
        userAnswer: 'x',
        ratings: [{ itemId: aItem.itemId, rating: 3, role: 'TARGET' }],
      }),
    ).rejects.toThrow();

    // Deleting A's item AS B: no row matches (id, userId=B) → P2025, A's item survives.
    await expect(P.deleteItem(USER_B, aItem.itemId)).rejects.toThrow();
    expect((await P.listItems(USER_A)).some((i) => i.itemId === aItem.itemId)).toBe(true);

    // A grading their OWN sentence still works (the scope allows the legitimate path).
    const ok = await P.submitReview(USER_A, {
      sentenceId,
      userAnswer: 'câu A của tôi',
      ratings: [{ itemId: aItem.itemId, rating: 3, role: 'TARGET' }],
    });
    expect(ok.items[0].itemId).toBe(aItem.itemId);
  });

  it('due batches never cross users', async () => {
    const aBatch = await P.getDueBatch(USER_A);
    const bBatch = await P.getDueBatch(USER_B);
    const aExprs = aBatch.items.map((i) => i.expression);
    const bExprs = bBatch.items.map((i) => i.expression);
    expect(aExprs).not.toContain('BBB_pattern');
    expect(bExprs).not.toContain('AAA_pattern');
  });
});
