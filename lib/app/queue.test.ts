import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';
import type { recordReviews as RecordReviews } from '@/lib/app/record-review';

createTestDb('sakubun-app-queue-');

type Practice = typeof import('@/lib/library/practice');
type App = typeof import('@/lib/app/queue');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let Q: App;
let prisma: Db['prisma'];
let db: UserDb;
let recordReviews: typeof RecordReviews;

// After any real clock reading in CI, so items created "now" by addItems are already in the past.
const NOW = new Date('2030-01-15T03:00:00.000Z');
const MINUTE = 60_000;

async function seed(kind: 'GRAMMAR' | 'VOCAB', count: number, level = 'N5'): Promise<string[]> {
  const expressions = Array.from({ length: count }, (_, i) => `${kind}_${level}_${i}`);
  await P.addItems(
    db,
    expressions.map((expression) => ({ expression, meaningVi: 'nghĩa', level })),
    'MCP',
    kind,
  );
  const rows = await db.item.findMany({
    where: { kind },
    select: { id: true, expression: true },
  });
  return expressions.map((e) => rows.find((r) => r.expression === e)!.id);
}

async function review(itemId: string, rating: 1 | 2 | 3 | 4, at: Date): Promise<void> {
  const srs = await db.srsState.findUniqueOrThrow({ where: { itemId } });
  await recordReviews(db, [{ itemId, srs, rating }], { retention: 0.9, now: at });
}

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  Q = await import('@/lib/app/queue');
  ({ recordReviews } = await import('@/lib/app/record-review'));
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('getQueue', () => {
  it('leaves kanji cards out, new or due, and does not count them as new grammar (KJ2)', async () => {
    await P.saveSettings(db, { dailyNewGrammar: 1 });
    const [kanji, due] = await seed('GRAMMAR', 2);
    await db.item.updateMany({ where: { id: { in: [kanji, due] } }, data: { kind: 'KANJI' } });
    await review(due, 3, new Date(NOW.getTime() - 30 * 86_400_000));
    await review(kanji, 3, NOW);
    const [grammar] = await seed('GRAMMAR', 1);
    const queue = await Q.getQueue(db, NOW);
    expect(queue.cards.map((c) => c.id)).toEqual([grammar]);
    expect(queue.today.newGrammar).toBe(0);
  });

  it('introduces new vocabulary under its own daily cap, not as due', async () => {
    await P.saveSettings(db, { dailyNewVocab: 4 });
    await seed('VOCAB', 9);
    const queue = await Q.getQueue(db, NOW);
    expect(queue.cards).toHaveLength(4);
    expect(queue.cards.every((c) => c.kind === 'VOCAB' && c.state === 0)).toBe(true);
  });

  it('caps new grammar by dailyNewGrammar and serves both kinds together', async () => {
    await P.saveSettings(db, { dailyNewGrammar: 2 });
    await seed('GRAMMAR', 4);
    await seed('VOCAB', 3);
    const queue = await Q.getQueue(db, NOW);
    expect(queue.cards.filter((c) => c.kind === 'GRAMMAR')).toHaveLength(2);
    expect(queue.cards.filter((c) => c.kind === 'VOCAB')).toHaveLength(3);
    expect(queue.cards[0]).toMatchObject({ meaningVi: 'nghĩa', level: 'N5' });
  });

  it('counts what was introduced today, per kind', async () => {
    await P.saveSettings(db, { dailyNewGrammar: 2 });
    const grammar = await seed('GRAMMAR', 3);
    const vocab = await seed('VOCAB', 1);
    await review(grammar[0], 3, NOW);
    await review(vocab[0], 3, NOW);

    const queue = await Q.getQueue(db, new Date(NOW.getTime() + MINUTE));
    expect(queue.today).toEqual({ newGrammar: 1, newVocab: 1, newKanji: 0, reviews: 0 });
    expect(queue.cards.filter((c) => c.kind === 'GRAMMAR' && c.state === 0)).toHaveLength(1);
  });

  it('serves a started item once due, before new items, and never a suspended one', async () => {
    const [due, suspended] = await seed('VOCAB', 2);
    await seed('GRAMMAR', 1);
    await review(due, 1, NOW);
    await review(suspended, 1, NOW);
    await P.setItemSuspended(db, suspended, true);

    const later = new Date(NOW.getTime() + 30 * MINUTE);
    const queue = await Q.getQueue(db, later);
    expect(queue.cards[0].id).toBe(due);
    expect(queue.cards.map((c) => c.id)).not.toContain(suspended);
  });

  it('a backlog of overdue reviews never hides a card that is mid-step', async () => {
    await P.saveSettings(db, { maxReviewsPerDay: 500 });
    const backlog = await seed('VOCAB', 301);
    const [learning] = await seed('GRAMMAR', 1);
    await db.srsState.updateMany({
      where: { itemId: { in: backlog } },
      data: { state: 2, due: new Date(NOW.getTime() - 86_400_000), reps: 3 },
    });
    await db.srsState.update({
      where: { itemId: learning },
      data: { state: 1, due: new Date(NOW.getTime() - MINUTE), reps: 1 },
    });

    const queue = await Q.getQueue(db, NOW);
    expect(queue.cards[0].id).toBe(learning);
    expect(queue.cards.filter((c) => c.state === 2)).toHaveLength(301);
  });

  it('fetches reviews only up to what is left of the daily allowance', async () => {
    await P.saveSettings(db, { maxReviewsPerDay: 10 });
    const backlog = await seed('VOCAB', 12);
    await db.srsState.updateMany({
      where: { itemId: { in: backlog } },
      data: { state: 2, due: new Date(NOW.getTime() - 86_400_000), reps: 3 },
    });
    const queue = await Q.getQueue(db, NOW);
    expect(queue.cards.filter((c) => c.state === 2)).toHaveLength(10);
  });

  it('brings new vocabulary in from the level studied, not N5 first (thien, 2026-11-07)', async () => {
    await P.saveSettings(db, { vocabLevel: 'N3', dailyNewVocab: 8 });
    // N5 went into the library first, as OpenJLPT's N5 did for thien.
    await seed('VOCAB', 10, 'N5');
    await seed('VOCAB', 10, 'N4');
    await seed('VOCAB', 10, 'N3');
    await seed('VOCAB', 10, 'N2');
    const queue = await Q.getQueue(db, NOW);
    expect(queue.cards.map((c) => c.level)).toEqual([
      'N3',
      'N3',
      'N3',
      'N4',
      'N3',
      'N3',
      'N3',
      'N4',
    ]);
  });

  it('keeps grammar and vocabulary on their own levels', async () => {
    await P.saveSettings(db, {
      grammarLevel: 'N4',
      vocabLevel: 'N2',
      dailyNewGrammar: 3,
      dailyNewVocab: 3,
    });
    await seed('GRAMMAR', 3, 'N4');
    await seed('GRAMMAR', 3, 'N2');
    await seed('VOCAB', 3, 'N4');
    await seed('VOCAB', 3, 'N2');
    const queue = await Q.getQueue(db, NOW);
    const of = (kind: string) => queue.cards.filter((c) => c.kind === kind).map((c) => c.level);
    expect(of('GRAMMAR')).toEqual(['N4', 'N4', 'N4']);
    expect(of('VOCAB')).toEqual(['N2', 'N2', 'N2']);
  });

  it('takes the easier one as the fourth new item counted over all days', async () => {
    await P.saveSettings(db, { vocabLevel: 'N4', dailyNewVocab: 1 });
    const n4 = await seed('VOCAB', 5, 'N4');
    await seed('VOCAB', 5, 'N5');
    for (const id of n4.slice(0, 3)) await review(id, 3, new Date(NOW.getTime() - 3 * 86_400_000));
    const queue = await Q.getQueue(db, NOW);
    expect(queue.cards.filter((c) => c.state === 0).map((c) => c.level)).toEqual(['N5']);
  });

  it('tells when the next item comes back once nothing is left', async () => {
    const [id] = await seed('GRAMMAR', 1);
    await review(id, 3, NOW);
    const queue = await Q.getQueue(db, new Date(NOW.getTime() + MINUTE));
    expect(queue.cards).toEqual([]);
    expect(queue.nextDueAt).not.toBeNull();
  });
});

describe('getQueue with kanji (KJ3)', () => {
  const kanjiCards = (queue: Awaited<ReturnType<App['getQueue']>>) =>
    queue.cards.filter((c) => c.kind === 'KANJI').map((c) => c.expression);

  it('brings in the kanji of started words first, up to the daily cap, and only in Ôn nhanh', async () => {
    await P.saveSettings(db, { dailyNewKanji: 3, dailyNewVocab: 0 });
    const [word] = await seed('VOCAB', 1);
    await db.item.update({ where: { id: word }, data: { expression: '経済' } });
    await review(word, 3, new Date(NOW.getTime() - 3 * 86_400_000));

    expect(kanjiCards(await Q.getQueue(db, NOW))).toEqual([]);
    expect(await db.item.count({ where: { kind: 'KANJI' } })).toBe(0);

    const queue = await Q.getQueue(db, NOW, undefined, { kanji: true });
    expect(kanjiCards(queue)).toEqual(['経', '済', '日']);
    expect(queue.left.newKanji).toBe(3);
    const made = await db.item.findMany({
      where: { kind: 'KANJI' },
      orderBy: { createdAt: 'asc' },
    });
    expect(made.map((k) => k.expression)).toEqual(['経', '済', '日']);
    expect(made[0]).toMatchObject({ hanviet: 'KINH', source: 'JOYO', level: 'N4' });

    // Asking again the same day brings in nothing more while those wait.
    await Q.getQueue(db, NOW, undefined, { kanji: true });
    expect(await db.item.count({ where: { kind: 'KANJI' } })).toBe(3);
  });

  it('counts the kanji met today against the cap, and brings in none past it', async () => {
    await P.saveSettings(db, { dailyNewKanji: 2 });
    const first = await Q.getQueue(db, NOW, undefined, { kanji: true });
    for (const c of first.cards) await review(c.id, 3, NOW);

    const later = await Q.getQueue(db, new Date(NOW.getTime() + MINUTE), undefined, {
      kanji: true,
    });
    expect(later.today.newKanji).toBe(2);
    expect(kanjiCards(later).length).toBeLessThanOrEqual(2);
    expect(later.cards.every((c) => c.state !== 0)).toBe(true);
    expect(await db.item.count({ where: { kind: 'KANJI' } })).toBe(2);
  });

  it("brings in kanji from the learner's vocabulary level once started words are covered", async () => {
    await P.saveSettings(db, { dailyNewKanji: 2, dailyNewVocab: 0, vocabLevel: 'N2' });
    await Q.getQueue(db, NOW, undefined, { kanji: true });
    const made = await db.item.findMany({ where: { kind: 'KANJI' }, select: { level: true } });
    expect(made.map((k) => k.level)).toEqual(['N2', 'N2']);
  });

  it('brings in no kanji when the daily cap is 0', async () => {
    await P.saveSettings(db, { dailyNewKanji: 0 });
    expect(kanjiCards(await Q.getQueue(db, NOW, undefined, { kanji: true }))).toEqual([]);
    expect(await db.item.count({ where: { kind: 'KANJI' } })).toBe(0);
  });
});
