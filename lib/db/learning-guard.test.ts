import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import { LEARNING_MODELS } from '@/lib/db/learner-scope';

createTestDb('sakubun-learning-guard-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
});

type Delegate = Record<string, (args?: object) => Promise<unknown>>;
const delegate = (model: string) =>
  (prisma as unknown as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)];

// Roadmap 7.1d: a query that forgot its learner fails instead of reading everyone's rows.
describe('the shared client', () => {
  it.each(LEARNING_MODELS)('refuses %s', async (model) => {
    for (const op of ['findMany', 'count', 'deleteMany']) {
      await expect(delegate(model)[op]({}), `${model}.${op}`).rejects.toThrow(
        `${model}.${op} needs a learner`,
      );
    }
  });

  it('still serves the account tables and raw SQL', async () => {
    await expect(prisma.user.count()).resolves.toBe(0);
    await expect(prisma.$queryRaw`SELECT 1 AS one`).resolves.toEqual([{ one: 1n }]);
  });
});
