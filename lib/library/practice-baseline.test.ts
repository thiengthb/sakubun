import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';
import type { RatingValue } from '@/lib/srs/srs';

// Characterization tests for the core rewrite (docs/roadmap.md, PR 0.2). They pin what the learning
// core does TODAY, through the real write path, so each rewrite step shows exactly which behaviour it
// keeps and which it changes on purpose. The last block records known flaws the roadmap fixes; those
// expectations flip in the PR that fixes them, never silently.

createTestDb('sakubun-baseline-');

type Practice = typeof import('@/lib/library/practice');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let prisma: Db['prisma'];

// After any real clock reading in CI, so items created "now" by addItems are already in the past.
const NOW = new Date('2030-01-15T03:00:00.000Z');
const MINUTE = 60_000;

async function reset(): Promise<void> {
  await resetLearningData(prisma);
  P.invalidateStreak();
}

async function seed(expressions: string[], kind: 'GRAMMAR' | 'VOCAB' = 'GRAMMAR', level = 'N5') {
  await P.addItems(
    expressions.map((expression) => ({ expression, meaningVi: 'nghĩa', level })),
    'MCP',
    kind,
  );
  const rows = await P.listItems({ kind });
  return expressions.map((e) => {
    const row = rows.find((r) => r.expression === e);
    if (!row) throw new Error(`seed failed: ${e}`);
    return row.itemId;
  });
}

async function review(itemId: string, rating: RatingValue, at: Date) {
  const { sentenceId } = await P.stageSentence(
    { direction: 'JA_VI', sourceText: '文', suggested: 'câu', items: [{ itemId, role: 'TARGET' }] },
    at,
  );
  return P.submitReview(
    { sentenceId, userAnswer: 'trả lời', ratings: [{ itemId, rating, role: 'TARGET' }] },
    at,
  );
}

async function srsOf(itemId: string) {
  const row = await prisma.srsState.findUniqueOrThrow({ where: { itemId } });
  return {
    state: row.state,
    reps: row.reps,
    lapses: row.lapses,
    minutesUntilDue: Math.round((row.due.getTime() - (row.lastReview?.getTime() ?? 0)) / MINUTE),
  };
}

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  ({ prisma } = await import('@/lib/db/db'));
});

describe('FSRS outcome of one review (must survive the rewrite unchanged)', () => {
  it('a new item rated 1-4 lands in these states and intervals', async () => {
    const outcomes: Record<number, Awaited<ReturnType<typeof srsOf>>> = {};
    for (const rating of [1, 2, 3, 4] as const) {
      await reset();
      const [id] = await seed([`pattern_${rating}`]);
      await review(id, rating, NOW);
      outcomes[rating] = await srsOf(id);
    }
    expect(outcomes).toMatchInlineSnapshot(`
      {
        "1": {
          "lapses": 0,
          "minutesUntilDue": 1,
          "reps": 1,
          "state": 1,
        },
        "2": {
          "lapses": 0,
          "minutesUntilDue": 6,
          "reps": 1,
          "state": 1,
        },
        "3": {
          "lapses": 0,
          "minutesUntilDue": 10,
          "reps": 1,
          "state": 1,
        },
        "4": {
          "lapses": 0,
          "minutesUntilDue": 11520,
          "reps": 1,
          "state": 2,
        },
      }
    `);
  });

  it('Good, then Good again when due: the interval grows', async () => {
    await reset();
    const [id] = await seed(['pattern_growth']);
    await review(id, 3, NOW);
    const first = await prisma.srsState.findUniqueOrThrow({ where: { itemId: id } });
    await review(id, 3, first.due);
    const second = await srsOf(id);
    expect(second).toMatchInlineSnapshot(`
      {
        "lapses": 0,
        "minutesUntilDue": 2880,
        "reps": 2,
        "state": 2,
      }
    `);
  });

  it('Again on a review card counts a lapse', async () => {
    await reset();
    const [id] = await seed(['pattern_lapse']);
    await review(id, 4, NOW);
    const first = await prisma.srsState.findUniqueOrThrow({ where: { itemId: id } });
    await review(id, 1, first.due);
    expect(await srsOf(id)).toMatchInlineSnapshot(`
      {
        "lapses": 1,
        "minutesUntilDue": 10,
        "reps": 2,
        "state": 3,
      }
    `);
  });
});

describe('ReviewLog is append-only', () => {
  it('every graded review appends one row; deleting the item keeps the rows with itemId null', async () => {
    await reset();
    const [id] = await seed(['pattern_log']);
    await review(id, 3, NOW);
    const first = await prisma.srsState.findUniqueOrThrow({ where: { itemId: id } });
    await review(id, 3, first.due);
    expect(await prisma.reviewLog.count({ where: { itemId: id } })).toBe(2);

    await P.deleteItem(id);
    const logs = await prisma.reviewLog.findMany({});
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.itemId === null)).toBe(true);
  });
});

describe('daily caps and what counts as due (grammar)', () => {
  it('new grammar stops at dailyNewGrammar for the study day', async () => {
    await reset();
    await P.saveSettings({ dailyNewGrammar: 2 });
    const ids = await seed(['g1', 'g2', 'g3', 'g4', 'g5']);
    await review(ids[0], 3, NOW);
    await review(ids[1], 3, NOW);

    const batch = await P.getDueBatch(new Date(NOW.getTime() + MINUTE));
    expect(batch.today.newGrammar).toBe(2);
    expect(batch.limits.newGrammarLimitReached || batch.items.every((i) => !i.isNew)).toBe(true);
    expect(batch.items.filter((i) => i.role !== 'VOCAB' && i.isNew)).toEqual([]);
  });

  it('a suspended item is never served, even when due', async () => {
    await reset();
    const [id] = await seed(['g_suspended']);
    await review(id, 1, NOW);
    await P.setItemSuspended(id, true);

    const batch = await P.getDueBatch(new Date(NOW.getTime() + 2 * 86_400_000));
    expect(batch.items.map((i) => i.id)).not.toContain(id);
    expect(batch.dueNow).toBe(0);
  });

  it('a never-studied item is new, not due', async () => {
    await reset();
    await seed(['g_new']);
    const batch = await P.getDueBatch(NOW);
    expect(batch.dueNow).toBe(0);
    expect(batch.newAvailable.grammar).toBe(1);
  });
});

describe('known flaws the roadmap fixes (expectations flip in the PR that fixes each)', () => {
  it('every never-studied vocab word is served as due, with no daily new cap (fixed in 1.1-1.2)', async () => {
    await reset();
    await P.saveSettings({ vocabPerSentence: 2 });
    await seed(['g_anchor']);
    await seed(['v1', 'v2', 'v3', 'v4', 'v5'], 'VOCAB');

    const batch = await P.getDueBatch(NOW);
    const vocab = batch.items.filter((i) => i.role === 'VOCAB');
    expect(vocab).toHaveLength(2);
    expect(vocab.every((v) => v.isNew)).toBe(true);
  });

  it('vocab reviews are invisible to the daily counters (fixed in 1.1-1.2)', async () => {
    await reset();
    const [vocabId] = await seed(['v_counted'], 'VOCAB');
    await review(vocabId, 3, NOW);

    const settings = await P.getSettings();
    const today = await P.todayCounts(settings, new Date(NOW.getTime() + MINUTE));
    expect(today.reviews).toBe(0);
    expect(today.newGrammar).toBe(0);
  });

  it('one sentence rates several items at once (fixed in 3.1: one target item per turn)', async () => {
    await reset();
    const [a, b] = await seed(['g_a', 'g_b']);
    const { sentenceId } = await P.stageSentence(
      {
        direction: 'JA_VI',
        sourceText: '文',
        suggested: 'câu',
        items: [
          { itemId: a, role: 'TARGET' },
          { itemId: b, role: 'SECONDARY' },
        ],
      },
      NOW,
    );
    const result = await P.submitReview(
      {
        sentenceId,
        userAnswer: 'trả lời',
        ratings: [
          { itemId: a, rating: 3, role: 'TARGET' },
          { itemId: b, rating: 3, role: 'SECONDARY' },
        ],
      },
      NOW,
    );
    expect(result.items).toHaveLength(2);
    expect(await prisma.reviewLog.count({ where: { sentenceId } })).toBe(2);
  });
});
