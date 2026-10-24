import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';
import type { RatingValue } from '@/lib/srs/srs';

// Characterization tests from the core rewrite (docs/roadmap.md, PR 0.2): the FSRS outcome of a review
// and the append-only log, pinned through the one write path (recordReviews). The old practice path
// they were first written against is gone (5.1); the numbers must not move.

createTestDb('sakubun-baseline-');

type Practice = typeof import('@/lib/library/practice');
type RecordModule = typeof import('@/lib/app/record-review');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let R: RecordModule;
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
  const srs = await prisma.srsState.findUniqueOrThrow({ where: { itemId } });
  const { desiredRetention } = await P.getSettings();
  return R.recordReviews([{ itemId, srs, rating }], { retention: desiredRetention, now: at });
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
  R = await import('@/lib/app/record-review');
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
