import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

createTestDb('sakubun-app-outside-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let O: typeof import('@/lib/app/outside-shelves');
let P: typeof import('@/lib/library/practice');
let G: typeof import('@/lib/library/groups');
let mine: UserDb;
let other: UserDb;

const NOW = new Date('2030-01-15T03:00:00.000Z');

const starter = (expression: string): StarterItem => ({
  id: `VOCAB-${expression}`,
  kind: 'VOCAB',
  expression,
  reading: 'よみ',
  hanviet: null,
  meaningVi: `nghĩa ${expression}`,
  level: 'N5',
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});

async function add(db: UserDb, expression: string, source: string) {
  await P.addItems(db, [{ expression, meaningVi: 'nghĩa' }], source, 'VOCAB');
  return db.item.findFirstOrThrow({ where: { expression } });
}

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  O = await import('@/lib/app/outside-shelves');
  P = await import('@/lib/library/practice');
  G = await import('@/lib/library/groups');
  const S = await import('@/lib/library/shared');
  const { userDb } = await import('@/lib/db/user-db');
  mine = userDb(await createTestUser(prisma, 'learner'));
  other = userDb(await createTestUser(prisma, 'other'));
  await prisma.libraryEntry.deleteMany();
  await S.seedOpenJlpt(prisma, [starter('店')]);
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('loadOutsideShelves (U4e)', () => {
  it("shows the learner's own items outside JLPT by source, and their groups", async () => {
    const shop = await add(mine, '店', 'MANUAL');
    const deadline = await add(mine, '締め切り', 'MCP');
    await add(mine, '先輩', 'MANUAL');
    await add(other, '推し', 'MCP');
    const group = await G.createGroup(mine, { name: 'Bài dịch' });
    await G.addItemsToGroup(mine, group.id, [shop.id, deadline.id]);
    await G.createGroup(other, { name: 'Của người khác' });

    const shelves = await O.loadOutsideShelves(mine, NOW);
    expect(shelves.outside).toBe(2);
    expect(shelves.sources.map((s) => [s.key, s.size])).toEqual([
      ['mcp', 1],
      ['manual', 1],
    ]);
    expect(shelves.groups.map((g) => [g.title, g.size])).toEqual([['Bài dịch', 2]]);
  });

  it('lists one source oldest first', async () => {
    await add(mine, '先輩', 'MANUAL');
    await add(mine, '名刺', 'MANUAL');
    await add(mine, '締め切り', 'MCP');
    const items = await O.loadOutsideItems(mine, 'manual');
    expect(items.map((i) => i.expression)).toEqual(['先輩', '名刺']);
    expect(await O.loadOutsideItems(other, 'manual')).toEqual([]);
  });
});
