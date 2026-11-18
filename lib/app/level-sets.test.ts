import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

createTestDb('sakubun-app-level-sets-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let L: typeof import('@/lib/app/level-sets');
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
  meaningVi: `nghĩa ${expression}`,
  level,
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});

// Not in kana order on purpose: the sets follow the group, not the alphabet.
const DECK = [
  starter('VOCAB', '店', 'N5'),
  starter('VOCAB', '会う', 'N5'),
  starter('VOCAB', '静か', 'N5'),
  starter('VOCAB', '切符', 'N4'),
  starter('GRAMMAR', '〜は', 'N5'),
];

async function add(db: UserDb, kind: string, expression: string) {
  await P.addItems(db, [{ expression, meaningVi: 'nghĩa' }], 'MANUAL', kind);
  return db.item.findFirstOrThrow({ where: { kind, expression } });
}

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  L = await import('@/lib/app/level-sets');
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

describe('loadLevelSets (U4c1)', () => {
  it('lists the level in its group order with what the learner has', async () => {
    const shop = await add(mine, 'VOCAB', '店');
    await mine.srsState.update({
      where: { itemId: shop.id },
      data: { state: 2, due: new Date('2030-02-01T00:00:00Z'), lapses: 2 },
    });
    await add(mine, 'VOCAB', '静か');

    const result = await L.loadLevelSets(mine, 'N5', 'VOCAB', NOW);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0]!.words.map((w) => [w.entry.expression, w.state])).toEqual([
      ['店', 'mastered'],
      ['会う', 'none'],
      ['静か', 'new'],
    ]);
    expect(result.sets[0]!.words[1]!.entry.meaningVi).toBe('nghĩa 会う');
    expect(result.mastered).toBe(1);
    expect(result.next).toEqual({ set: 1, kind: 'study', count: 1 });
    expect(result.forgotten.map((w) => w.entry.expression)).toEqual(['店']);
  });

  it("never shows another learner's items", async () => {
    await add(other, 'VOCAB', '店');
    const result = await L.loadLevelSets(mine, 'N5', 'VOCAB', NOW);
    expect(result.counts.none).toBe(3);
  });

  it('keeps kinds and levels apart, and an empty level has no sets', async () => {
    expect((await L.loadLevelSets(mine, 'N4', 'VOCAB', NOW)).counts.none).toBe(1);
    expect((await L.loadLevelSets(mine, 'N5', 'GRAMMAR', NOW)).counts.none).toBe(1);
    expect((await L.loadLevelSets(mine, 'N1', 'VOCAB', NOW)).sets).toEqual([]);
  });

  it('leaves out an entry hidden from Kho chung', async () => {
    await prisma.libraryEntry.updateMany({
      where: { type: 'VOCAB', expression: '会う' },
      data: { status: 'hidden' },
    });
    const result = await L.loadLevelSets(mine, 'N5', 'VOCAB', NOW);
    expect(result.sets[0]!.words.map((w) => w.entry.expression)).toEqual(['店', '静か']);
    await prisma.libraryEntry.updateMany({
      where: { type: 'VOCAB', expression: '会う' },
      data: { status: 'public' },
    });
  });

  it('agrees with the level board when an admin hides the level group', async () => {
    await prisma.libraryEntry.updateMany({
      where: { sourceKey: 'openjlpt:group:N5:VOCAB' },
      data: { status: 'hidden' },
    });
    await add(mine, 'VOCAB', '店');
    const result = await L.loadLevelSets(mine, 'N5', 'VOCAB', NOW);
    const cell = (await B.levelBoard(mine)).levels[0]!.vocab;
    expect(result.sets[0]!.words.map((w) => w.entry.expression)).toEqual(['店', '会う', '静か']);
    expect(result.sets[0]!.words.length).toBe(cell.total);
    expect(cell.total - result.counts.none).toBe(cell.have);
    await prisma.libraryEntry.updateMany({
      where: { sourceKey: 'openjlpt:group:N5:VOCAB' },
      data: { status: 'public' },
    });
  });
});
