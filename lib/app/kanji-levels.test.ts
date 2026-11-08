import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-app-kanji-levels-');

type Levels = typeof import('@/lib/app/kanji-levels');
type Practice = typeof import('@/lib/library/practice');
let L: Levels;
let P: Practice;
let prisma: (typeof import('@/lib/db/db'))['prisma'];
let db: UserDb;

const NOW = new Date('2030-01-15T03:00:00.000Z');

beforeAll(async () => {
  L = await import('@/lib/app/kanji-levels');
  P = await import('@/lib/library/practice');
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('Kho chung kanji levels (KJ5)', () => {
  it('sizes each level from the catalog and counts the kanji the learner has', async () => {
    const before = await L.kanjiLevels(db);
    expect(before.map((l) => l.level)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1']);
    expect(before.every((l) => l.size > 0 && l.have === 0)).toBe(true);
    const n5 = await L.kanjiLevel(db, 'N5');
    expect(n5.kanji).toHaveLength(before[0].size);
    expect(n5.kanji.every((k) => k.level === 'N5')).toBe(true);

    await L.takeKanjiLevel(db, 'N5', NOW);
    const after = await L.kanjiLevels(db);
    expect(after[0]).toEqual({ level: 'N5', size: before[0].size, have: before[0].size });
    expect(after[1].have).toBe(0);
    expect((await L.kanjiLevel(db, 'N5')).have.size).toBe(before[0].size);
  });

  it('makes new cards for the kanji the learner lacks, those of started words first', async () => {
    await P.addItems(
      db,
      [{ expression: '経験', meaningVi: 'kinh nghiệm', level: 'N4' }],
      'MCP',
      'VOCAB',
    );
    await db.srsState.updateMany({ data: { state: 2, reps: 2 } });
    await db.item.create({
      data: {
        userId: db.$ownerId(),
        kind: 'KANJI',
        expression: '経',
        meaningVi: 'đi qua',
        level: 'N4',
        srs: { create: { userId: db.$ownerId(), due: NOW } },
      },
    });

    const taken = await L.takeKanjiLevel(db, 'N4', NOW);
    const size = (await L.kanjiLevel(db, 'N4')).kanji.length;
    expect(taken).toEqual({ added: size - 1, had: 1 });
    const made = await db.item.findMany({
      where: { kind: 'KANJI', source: 'JOYO' },
      orderBy: { createdAt: 'asc' },
      include: { srs: true },
    });
    expect(made).toHaveLength(size - 1);
    // 経 was had; 験 is in the started 経験, so it comes first.
    expect(made[0]).toMatchObject({ expression: '験', level: 'N4', hanviet: 'NGHIỆM' });
    expect(made.every((k) => k.srs?.state === 0)).toBe(true);

    expect(await L.takeKanjiLevel(db, 'N4', NOW)).toEqual({ added: 0, had: size });
  });

  it('tells a level apart from anything else', () => {
    expect(L.isKanjiLevel('N3')).toBe(true);
    expect(L.isKanjiLevel('N6')).toBe(false);
  });
});
