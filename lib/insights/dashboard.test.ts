import { beforeAll, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-dashboard-');

type Db = typeof import('@/lib/db/db');
let P: typeof import('@/lib/library/practice');
let R: typeof import('@/lib/app/record-review');
let D: typeof import('@/lib/insights/dashboard');
let S: typeof import('@/lib/insights/streak');
let prisma: Db['prisma'];
let db: UserDb;

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  R = await import('@/lib/app/record-review');
  D = await import('@/lib/insights/dashboard');
  S = await import('@/lib/insights/streak');
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

async function reset() {
  await resetLearningData(prisma);
  S.invalidateStreak();
}

async function studied(expression: string, rating: 1 | 3, errorTags?: string[]) {
  await P.addItems(db, [{ expression, meaningVi: 'nghĩa' }], 'MCP', 'GRAMMAR');
  const row = (await P.listItems(db, { kind: 'GRAMMAR' })).find(
    (i) => i.expression === expression,
  )!;
  const srs = await db.srsState.findUniqueOrThrow({ where: { itemId: row.itemId } });
  await R.recordReviews(
    db,
    [{ itemId: row.itemId, srs, rating, ...(errorTags ? { errorTags: errorTags as never } : {}) }],
    { retention: 0.9, now: new Date() },
  );
}

describe('getDashboard reads the database once for the whole Phân tích page', () => {
  it('a library with one review: counts, streak and the daily table agree', async () => {
    await reset();
    await studied('DASH_one', 3);
    const d = await D.getDashboard(db);
    expect(d.grammarTotal).toBe(1);
    expect(d.mastery.new + d.mastery.learning + d.mastery.review + d.mastery.relearning).toBe(1);
    expect(d.study.daily.at(-1)!.reviews).toBe(1);
    expect(d.reviewsLast30).toBe(1);
    expect(d.streak.current).toBeGreaterThanOrEqual(1);
    expect(await S.getStreak(db)).toEqual(d.streak);
  });

  it('no reviews: a zero streak and empty activity', async () => {
    await reset();
    const d = await D.getDashboard(db);
    expect(d.streak.current).toBe(0);
    expect(d.activity.every((a) => a.count === 0)).toBe(true);
  });

  it('a missed review with a tag reaches the weak spots', async () => {
    await reset();
    await studied('DASH_weak', 1, ['particle']);
    const d = await D.getDashboard(db);
    expect(d.weak.tagCounts.find((t) => t.tag === 'particle')?.count).toBe(1);
    expect(d.weak.worstItems[0]?.expression).toBe('DASH_weak');
  });
});
