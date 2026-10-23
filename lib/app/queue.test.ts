import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-app-queue-');

type Practice = typeof import('@/lib/library/practice');
type App = typeof import('@/lib/app/queue');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let Q: App;
let prisma: Db['prisma'];

// After any real clock reading in CI, so items created "now" by addItems are already in the past.
const NOW = new Date('2030-01-15T03:00:00.000Z');
const MINUTE = 60_000;

async function seed(kind: 'GRAMMAR' | 'VOCAB', count: number, level = 'N5'): Promise<string[]> {
  const expressions = Array.from({ length: count }, (_, i) => `${kind}_${level}_${i}`);
  await P.addItems(
    expressions.map((expression) => ({ expression, meaningVi: 'nghĩa', level })),
    'MCP',
    kind,
  );
  const rows = await prisma.item.findMany({
    where: { kind },
    select: { id: true, expression: true },
  });
  return expressions.map((e) => rows.find((r) => r.expression === e)!.id);
}

async function review(itemId: string, rating: 1 | 2 | 3 | 4, at: Date): Promise<void> {
  const { sentenceId } = await P.stageSentence(
    { direction: 'JA_VI', sourceText: '文', suggested: 'câu', items: [{ itemId, role: 'TARGET' }] },
    at,
  );
  await P.submitReview(
    { sentenceId, userAnswer: 'trả lời', ratings: [{ itemId, rating, role: 'TARGET' }] },
    at,
  );
}

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  Q = await import('@/lib/app/queue');
  ({ prisma } = await import('@/lib/db/db'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('getQueue', () => {
  it('introduces new vocabulary under its own daily cap, not as due', async () => {
    await seed('VOCAB', Q.DEFAULT_DAILY_NEW_VOCAB + 5);
    const queue = await Q.getQueue(NOW);
    expect(queue.cards).toHaveLength(Q.DEFAULT_DAILY_NEW_VOCAB);
    expect(queue.cards.every((c) => c.kind === 'VOCAB' && c.state === 0)).toBe(true);
  });

  it('caps new grammar by dailyNewGrammar and serves both kinds together', async () => {
    await P.saveSettings({ dailyNewGrammar: 2 });
    await seed('GRAMMAR', 4);
    await seed('VOCAB', 3);
    const queue = await Q.getQueue(NOW);
    expect(queue.cards.filter((c) => c.kind === 'GRAMMAR')).toHaveLength(2);
    expect(queue.cards.filter((c) => c.kind === 'VOCAB')).toHaveLength(3);
    expect(queue.cards[0]).toMatchObject({ meaningVi: 'nghĩa', level: 'N5' });
  });

  it('counts what was introduced today, per kind', async () => {
    await P.saveSettings({ dailyNewGrammar: 2 });
    const grammar = await seed('GRAMMAR', 3);
    const vocab = await seed('VOCAB', 1);
    await review(grammar[0], 3, NOW);
    await review(vocab[0], 3, NOW);

    const queue = await Q.getQueue(new Date(NOW.getTime() + MINUTE));
    expect(queue.today).toEqual({ newGrammar: 1, newVocab: 1, reviews: 0 });
    expect(queue.cards.filter((c) => c.kind === 'GRAMMAR' && c.state === 0)).toHaveLength(1);
  });

  it('serves a started item once due, before new items, and never a suspended one', async () => {
    const [due, suspended] = await seed('VOCAB', 2);
    await seed('GRAMMAR', 1);
    await review(due, 1, NOW);
    await review(suspended, 1, NOW);
    await P.setItemSuspended(suspended, true);

    const later = new Date(NOW.getTime() + 30 * MINUTE);
    const queue = await Q.getQueue(later);
    expect(queue.cards[0].id).toBe(due);
    expect(queue.cards.map((c) => c.id)).not.toContain(suspended);
  });

  it('a backlog of overdue reviews never hides a card that is mid-step', async () => {
    await P.saveSettings({ maxReviewsPerDay: 500 });
    const backlog = await seed('VOCAB', 301);
    const [learning] = await seed('GRAMMAR', 1);
    await prisma.srsState.updateMany({
      where: { itemId: { in: backlog } },
      data: { state: 2, due: new Date(NOW.getTime() - 86_400_000), reps: 3 },
    });
    await prisma.srsState.update({
      where: { itemId: learning },
      data: { state: 1, due: new Date(NOW.getTime() - MINUTE), reps: 1 },
    });

    const queue = await Q.getQueue(NOW);
    expect(queue.cards[0].id).toBe(learning);
    expect(queue.cards.filter((c) => c.state === 2)).toHaveLength(301);
  });

  it('fetches reviews only up to what is left of the daily allowance', async () => {
    await P.saveSettings({ maxReviewsPerDay: 10 });
    const backlog = await seed('VOCAB', 12);
    await prisma.srsState.updateMany({
      where: { itemId: { in: backlog } },
      data: { state: 2, due: new Date(NOW.getTime() - 86_400_000), reps: 3 },
    });
    const queue = await Q.getQueue(NOW);
    expect(queue.cards.filter((c) => c.state === 2)).toHaveLength(10);
  });

  it('keeps new vocabulary at or below the learner level', async () => {
    await P.saveSettings({ grammarLevels: ['N4'], vocabCeiling: null });
    await seed('VOCAB', 1, 'N5');
    await seed('VOCAB', 1, 'N4');
    await seed('VOCAB', 1, 'N2');
    const queue = await Q.getQueue(NOW);
    expect(queue.cards.map((c) => c.level).sort()).toEqual(['N4', 'N5']);
  });

  it('tells when the next item comes back once nothing is left', async () => {
    const [id] = await seed('GRAMMAR', 1);
    await review(id, 3, NOW);
    const queue = await Q.getQueue(new Date(NOW.getTime() + MINUTE));
    expect(queue.cards).toEqual([]);
    expect(queue.nextDueAt).not.toBeNull();
  });
});
