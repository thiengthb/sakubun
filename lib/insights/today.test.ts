import { beforeAll, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-today-');

type Db = typeof import('@/lib/db/db');
let P: typeof import('@/lib/library/practice');
let R: typeof import('@/lib/app/record-review');
let T: typeof import('@/lib/insights/today');
let S: typeof import('@/lib/insights/streak');
let prisma: Db['prisma'];
let db: UserDb;

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  R = await import('@/lib/app/record-review');
  T = await import('@/lib/insights/today');
  S = await import('@/lib/insights/streak');
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

async function reset(dailyNewKanji = 0) {
  await resetLearningData(prisma);
  S.invalidateStreak();
  await P.saveSettings(db, { dailyNewKanji });
}

async function grammar(expression: string) {
  await P.addItems(db, [{ expression, meaningVi: 'nghĩa' }], 'MCP', 'GRAMMAR');
  return (await P.listItems(db, { kind: 'GRAMMAR' })).find((i) => i.expression === expression)!;
}

async function review(itemId: string, rating: 1 | 3, now = new Date()) {
  const srs = await db.srsState.findUniqueOrThrow({ where: { itemId } });
  await R.recordReviews(db, [{ itemId, srs, rating }], { retention: 0.9, now });
}

describe('getToday reads what the Hôm nay page shows', () => {
  it('an empty library asks for a level', async () => {
    await reset(5);
    const t = await T.getToday(db);
    // Kanji Ôn nhanh would bring in are not cards yet, so nothing is waiting.
    expect(t.hero).toEqual({ kind: 'empty', kanjiWaiting: 0 });
    expect(t.streak.current).toBe(0);
    expect(t.week).toHaveLength(7);
  });

  it('a newcomer with kanji cards from Ôn nhanh still picks a level, and sees the kanji waiting', async () => {
    await reset(3);
    const { takeKanjiLevel } = await import('@/lib/app/kanji-levels');
    await takeKanjiLevel(db, 'N5');
    const t = await T.getToday(db);
    expect(t.hero).toEqual({ kind: 'empty', kanjiWaiting: 3 });
  });

  it('a new item is ready to learn, and the page has not started today', async () => {
    await reset();
    await grammar('TODAY_new');
    const t = await T.getToday(db);
    expect(t.hero).toMatchObject({ kind: 'ready', total: 1, newGrammar: 1, due: 0, resume: false });
    expect(t.hero.kind === 'ready' && t.hero.minutes).toBe(1);
  });

  it('counts the kanji Ôn nhanh would bring in without creating them', async () => {
    await reset(3);
    await grammar('TODAY_new');
    const t = await T.getToday(db);
    expect(t.hero).toMatchObject({ kind: 'ready', newKanji: 3, total: 4 });
    expect(await db.item.count({ where: { kind: 'KANJI' } })).toBe(0);
  });

  it('after the only card is studied: done for today, streak and week say so', async () => {
    await reset();
    const item = await grammar('TODAY_one');
    await review(item.itemId, 3);
    const t = await T.getToday(db);
    expect(t.hero).toMatchObject({ kind: 'done', reviewedToday: 1 });
    expect(t.hero.kind === 'done' && t.hero.nextDueAt).toBeInstanceOf(Date);
    expect(t.streak.current).toBe(1);
    expect(t.week.find((d) => d.today)!.studied).toBe(true);
  });

  it('a card due again after a lapse is offered as "Học tiếp", and misses are counted', async () => {
    await reset();
    const item = await grammar('TODAY_hard');
    const past = new Date(Date.now() - 3 * 86_400_000);
    await review(item.itemId, 1, past);
    await review(item.itemId, 1, new Date(past.getTime() + 60_000));
    // Bring it due now, then miss it once more today.
    await db.srsState.update({ where: { itemId: item.itemId }, data: { due: new Date(0) } });
    await review(item.itemId, 1);
    await db.srsState.update({ where: { itemId: item.itemId }, data: { due: new Date(0) } });
    const t = await T.getToday(db);
    expect(t.hero).toMatchObject({ kind: 'ready', due: 1, resume: true, reviewedToday: 1 });
    expect(t.missed).toEqual([{ itemId: item.itemId, expression: 'TODAY_hard', misses: 3 }]);
  });

  it('counts grammar studied without an example, and the cards due in the next 14 days', async () => {
    await reset();
    const item = await grammar('TODAY_bare');
    await review(item.itemId, 3);
    await db.srsState.update({
      where: { itemId: item.itemId },
      data: { due: new Date(Date.now() + 2 * 86_400_000) },
    });
    const t = await T.getToday(db);
    expect(t.missingExamples).toBe(1);
    expect(t.forecast.reduce((s, d) => s + d.count, 0)).toBe(1);
  });
});
