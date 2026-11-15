import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

createTestDb('sakubun-app-level-board-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let B: typeof import('@/lib/app/level-board');
let P: typeof import('@/lib/library/practice');
let mine: UserDb;
let other: UserDb;

const NOW = new Date('2030-01-15T03:00:00.000Z');

const starter = (kind: string, expression: string, level: string): StarterItem => ({
  id: `${kind}-${expression}`,
  kind,
  expression,
  reading: kind === 'VOCAB' ? 'よみ' : null,
  hanviet: null,
  meaningVi: 'nghĩa',
  level,
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});

const DECK = [
  starter('GRAMMAR', '〜は', 'N5'),
  starter('GRAMMAR', '〜が', 'N5'),
  starter('VOCAB', '店', 'N5'),
  starter('VOCAB', '静か', 'N5'),
  starter('VOCAB', '切符', 'N4'),
];

async function add(db: UserDb, kind: string, expression: string) {
  await P.addItems(db, [{ expression, meaningVi: 'nghĩa' }], 'MANUAL', kind);
  return db.item.findFirstOrThrow({ where: { kind, expression } });
}

async function master(db: UserDb, itemId: string) {
  await db.srsState.update({ where: { itemId }, data: { state: 2, due: NOW } });
}

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  B = await import('@/lib/app/level-board');
  P = await import('@/lib/library/practice');
  const S = await import('@/lib/library/shared');
  const { userDb } = await import('@/lib/db/user-db');
  mine = userDb(await createTestUser(prisma, 'learner'));
  other = userDb(await createTestUser(prisma, 'other'));
  await prisma.libraryEntry.deleteMany();
  await S.seedOpenJlpt(prisma, DECK);
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('levelBoard (U4a)', () => {
  it('counts the OpenJLPT entries of each level and what the learner has and masters', async () => {
    await master(mine, (await add(mine, 'GRAMMAR', '〜は')).id);
    await add(mine, 'VOCAB', '店');
    // Written by the learner with the default level N5, it still counts in N4 where the entry is.
    await master(mine, (await add(mine, 'VOCAB', '切符')).id);

    const board = await B.levelBoard(mine);
    const [n5, n4] = board.levels;
    expect(n5!.level).toBe('N5');
    expect(n5!.grammar).toEqual({ total: 2, have: 1, mastered: 1 });
    expect(n5!.vocab).toEqual({ total: 2, have: 1, mastered: 0 });
    expect(n4!.vocab).toEqual({ total: 1, have: 1, mastered: 1 });
    expect(n4!.grammar).toEqual({ total: 0, have: 0, mastered: 0 });
  });

  it('takes kanji totals from the catalog and owned kanji from the learner cards', async () => {
    const empty = await B.levelBoard(mine);
    const n5Kanji = empty.levels[0]!.kanji;
    expect(n5Kanji.total).toBeGreaterThan(50);
    expect(n5Kanji.have).toBe(0);

    const { kanjiCatalog } = await import('@/lib/kanji/load');
    const { createKanjiItems } = await import('@/lib/app/kanji-items');
    const first = (await kanjiCatalog()).find((k) => k.level === 'N5')!;
    await createKanjiItems(mine, [first], NOW);
    await master(mine, (await mine.item.findFirstOrThrow({ where: { kind: 'KANJI' } })).id);

    const board = await B.levelBoard(mine);
    expect(board.levels[0]!.kanji).toEqual({ total: n5Kanji.total, have: 1, mastered: 1 });
  });

  it('counts items outside JLPT and the learner groups', async () => {
    await add(mine, 'VOCAB', '店');
    await add(mine, 'VOCAB', '自分の言葉');
    await add(mine, 'GRAMMAR', '〜てしまう');
    const G = await import('@/lib/library/groups');
    await G.createGroup(mine, { name: 'Nhóm của tôi' });

    const board = await B.levelBoard(mine);
    expect(board.outside).toBe(2);
    expect(board.groups).toBe(1);
  });

  it('leaves hidden entries out of the totals', async () => {
    const shop = await prisma.libraryEntry.findFirstOrThrow({ where: { expression: '店' } });
    await prisma.libraryEntry.update({ where: { id: shop.id }, data: { status: 'hidden' } });
    try {
      await add(mine, 'VOCAB', '店');
      const board = await B.levelBoard(mine);
      expect(board.levels[0]!.vocab).toEqual({ total: 1, have: 0, mastered: 0 });
      expect(board.outside).toBe(0);
    } finally {
      await prisma.libraryEntry.update({ where: { id: shop.id }, data: { status: 'public' } });
    }
  });

  it("never counts another learner's items", async () => {
    await master(other, (await add(other, 'GRAMMAR', '〜は')).id);
    await add(other, 'VOCAB', '自分の言葉');
    await (await import('@/lib/library/groups')).createGroup(other, { name: 'Của người khác' });

    const board = await B.levelBoard(mine);
    expect(board.levels[0]!.grammar).toEqual({ total: 2, have: 0, mastered: 0 });
    expect(board.outside).toBe(0);
    expect(board.groups).toBe(0);
  });
});
