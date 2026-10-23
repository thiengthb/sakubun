import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-app-review-');

type Practice = typeof import('@/lib/library/practice');
type Record_ = typeof import('@/lib/app/record-review');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let R: Record_;
let prisma: Db['prisma'];

const NOW = new Date('2030-01-15T03:00:00.000Z');

async function seedOne(expression: string): Promise<string> {
  await P.addItems([{ expression, meaningVi: 'nghĩa' }], 'MCP', 'VOCAB');
  return (await P.listItems({ kind: 'VOCAB' })).find((r) => r.expression === expression)!.itemId;
}

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  R = await import('@/lib/app/record-review');
  ({ prisma } = await import('@/lib/db/db'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('recordReviews', () => {
  it('writes the new schedule and appends one log row, without any sentence', async () => {
    const itemId = await seedOne('約束');
    const srs = await prisma.srsState.findUniqueOrThrow({ where: { itemId } });

    const [recorded] = await R.recordReviews([{ itemId, srs, rating: 3 }], {
      retention: 0.9,
      now: NOW,
    });

    const after = await prisma.srsState.findUniqueOrThrow({ where: { itemId } });
    expect(after.reps).toBe(1);
    expect(after.due).toEqual(recorded.next.due);
    const logs = await prisma.reviewLog.findMany({ where: { itemId } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ rating: 3, state: 0, sentenceId: null, role: 'TARGET' });
  });

  it("commits the caller's rows in the same transaction: one failure writes nothing", async () => {
    const itemId = await seedOne('急ぐ');
    const srs = await prisma.srsState.findUniqueOrThrow({ where: { itemId } });
    const failing = prisma.item.update({ where: { id: 'no-such-item' }, data: { notes: 'x' } });

    await expect(
      R.recordReviews([{ itemId, srs, rating: 3 }], {
        retention: 0.9,
        now: NOW,
        alsoWrite: [failing],
      }),
    ).rejects.toThrow();

    expect((await prisma.srsState.findUniqueOrThrow({ where: { itemId } })).reps).toBe(0);
    expect(await prisma.reviewLog.count()).toBe(0);
  });
});
