import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, createTestUser } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

createTestDb('sakubun-shared-library-');

type Shared = typeof import('@/lib/library/shared');
type Db = typeof import('@/lib/db/db');
let L: Shared;
let prisma: Db['prisma'];

const item = (kind: string, expression: string, level: string, meaningVi: string): StarterItem => ({
  id: `${kind}-${expression}`,
  kind,
  expression,
  reading: null,
  hanviet: null,
  meaningVi,
  level,
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});

const DECK = [
  item('GRAMMAR', '〜ばかりに', 'N2', 'chỉ vì'),
  item('GRAMMAR', '〜てから', 'N5', 'sau khi'),
  item('VOCAB', '店', 'N5', 'cửa hàng'),
  item('VOCAB', '静か', 'N5', 'yên tĩnh'),
];

beforeAll(async () => {
  L = await import('@/lib/library/shared');
  ({ prisma } = await import('@/lib/db/db'));
});

beforeEach(async () => {
  await prisma.libraryEntry.deleteMany();
});

describe('seedOpenJlpt', () => {
  it('adds each pattern and word once, with no author, and the level groups', async () => {
    expect(await L.seedOpenJlpt(prisma, DECK)).toEqual({ entries: 4, groups: 3 });
    const groups = await L.listGroupEntries(prisma);
    expect(groups.map((g) => [g.name, g.size])).toEqual([
      ['N5 · Ngữ pháp', 1],
      ['N5 · Từ vựng', 2],
      ['N2 · Ngữ pháp', 1],
    ]);
    const entries = await prisma.libraryEntry.findMany({ where: { type: { not: 'GROUP' } } });
    expect(entries.every((e) => e.origin === 'OPENJLPT' && e.authorId === null)).toBe(true);
  });

  it('adds only what is missing when run again', async () => {
    await L.seedOpenJlpt(prisma, DECK.slice(0, 3));
    expect(await L.seedOpenJlpt(prisma, DECK)).toEqual({ entries: 1, groups: 0 });
    expect(await prisma.libraryEntry.count()).toBe(4 + 3);
    const vocab = (await L.listGroupEntries(prisma)).find((g) => g.name === 'N5 · Từ vựng')!;
    const group = await L.getGroupEntry(prisma, vocab.id);
    expect(group?.entries.map((e) => e.expression)).toEqual(['店', '静か']);
  });

  it('seeds the real OpenJLPT deck, and a second run adds nothing', async () => {
    const deck = await (await import('@/lib/import/starter-deck')).loadStarterDeck();
    const first = await L.seedOpenJlpt(prisma, deck);
    expect(first.entries).toBe(deck.length);
    expect(first.groups).toBe(10);
    expect(await L.seedOpenJlpt(prisma, deck)).toEqual({ entries: 0, groups: 0 });
    const sizes = (await L.listGroupEntries(prisma)).reduce((n, g) => n + g.size, 0);
    expect(sizes).toBe(deck.length);
  }, 60_000);
});

describe('searchEntries', () => {
  it('finds by expression, reading or meaning, OpenJLPT first, public only', async () => {
    await L.seedOpenJlpt(prisma, DECK);
    const author = await createTestUser(prisma, 'author');
    await prisma.libraryEntry.createMany({
      data: [
        {
          type: 'VOCAB',
          expression: '店',
          meaningVi: 'tiệm (bản của tôi)',
          level: 'N5',
          origin: 'LEARNER',
          authorId: author,
          takeCount: 5,
        },
        {
          type: 'VOCAB',
          expression: '店',
          meaningVi: 'đã gỡ',
          level: 'N5',
          origin: 'LEARNER',
          authorId: author,
          status: 'hidden',
        },
      ],
    });
    expect(
      (await L.searchEntries(prisma, { text: '店' })).map((e) => [e.origin, e.meaningVi]),
    ).toEqual([
      ['OPENJLPT', 'cửa hàng'],
      ['LEARNER', 'tiệm (bản của tôi)'],
    ]);
    expect((await L.searchEntries(prisma, { text: 'yên' })).map((e) => e.expression)).toEqual([
      '静か',
    ]);
    expect(
      (await L.searchEntries(prisma, { type: 'GRAMMAR', level: 'N2' })).map((e) => e.expression),
    ).toEqual(['〜ばかりに']);
  });
});

describe('getGroupEntry', () => {
  it('hides a group that is not public, and the hidden entries of one that is', async () => {
    await L.seedOpenJlpt(prisma, DECK);
    const vocab = (await L.listGroupEntries(prisma)).find((g) => g.name === 'N5 · Từ vựng')!;
    await prisma.libraryEntry.updateMany({
      where: { expression: '店' },
      data: { status: 'hidden' },
    });
    expect((await L.getGroupEntry(prisma, vocab.id))?.entries.map((e) => e.expression)).toEqual([
      '静か',
    ]);
    expect((await L.listGroupEntries(prisma)).find((g) => g.id === vocab.id)?.size).toBe(1);
    await prisma.libraryEntry.update({ where: { id: vocab.id }, data: { status: 'hidden' } });
    expect(await L.getGroupEntry(prisma, vocab.id)).toBeNull();
  });
});
