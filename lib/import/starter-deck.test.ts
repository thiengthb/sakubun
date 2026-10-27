import { beforeAll, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';
import { loadStarterDeck, missingStarterItems, type StarterItem } from './starter-deck';

createTestDb('sakubun-starter-deck-');

type Mod = typeof import('./starter-deck');
let M: Mod;
let prisma: typeof import('@/lib/db/db').prisma;
let a: UserDb;
let b: UserDb;
let deck: StarterItem[];

beforeAll(async () => {
  M = await import('./starter-deck');
  ({ prisma } = await import('@/lib/db/db'));
  const { userDb } = await import('@/lib/db/user-db');
  a = userDb(await createTestUser(prisma, 'learner-a'));
  b = userDb(await createTestUser(prisma, 'learner-b'));
  deck = (await loadStarterDeck()).slice(0, 40);
});

describe('missingStarterItems', () => {
  const item = (expression: string, kind = 'VOCAB') =>
    ({ id: `fixed-${expression}`, kind, expression }) as StarterItem;

  it('bỏ mục đã có (cùng loại và biểu thức), mục còn lại nhận id mới', () => {
    let n = 0;
    const out = missingStarterItems(
      [item('猫'), item('犬'), item('犬', 'GRAMMAR')],
      [{ kind: 'VOCAB', expression: '犬' }],
      () => `new-${++n}`,
    );
    expect(out.map((i) => [i.id, i.kind, i.expression])).toEqual([
      ['new-1', 'VOCAB', '猫'],
      ['new-2', 'GRAMMAR', '犬'],
    ]);
  });
});

describe('seedStarterDeck', () => {
  it('kho dựng từ data/openjlpt có cả ngữ pháp lẫn từ vựng, đã có nghĩa tiếng Việt', async () => {
    const full = await loadStarterDeck();
    expect(full.length).toBeGreaterThan(7000);
    expect(new Set(full.map((i) => i.kind))).toEqual(new Set(['GRAMMAR', 'VOCAB']));
    expect(full.every((i) => i.meaningVi && i.source === 'OPENJLPT')).toBe(true);
  });

  it('hai người mỗi người một bản riêng: id khác nhau, ghi chú của A không sang B', async () => {
    await resetLearningData(prisma);
    const now = new Date('2026-10-27T00:00:00Z');
    expect(await M.seedStarterDeck(a, deck, now)).toBe(deck.length);
    const first = await a.item.findFirstOrThrow({ where: { expression: deck[0].expression } });
    await a.item.update({
      where: { id: first.id },
      data: { notes: 'ghi chú riêng của A', starred: true },
    });

    expect(await M.seedStarterDeck(b, deck, now)).toBe(deck.length);

    const aIds = new Set((await a.item.findMany({ select: { id: true } })).map((i) => i.id));
    const bItems = await b.item.findMany({ include: { srs: true } });
    expect(bItems).toHaveLength(deck.length);
    expect(bItems.some((i) => aIds.has(i.id))).toBe(false);
    expect(bItems.some((i) => deck.some((d) => d.id === i.id))).toBe(false);
    expect(bItems.some((i) => i.notes === 'ghi chú riêng của A' || i.starred)).toBe(false);
    expect(bItems.every((i) => i.srs?.reps === 0 && i.srs.due.getTime() === now.getTime())).toBe(
      true,
    );
  });

  it('chạy lại không thêm trùng, chỉ bù mục còn thiếu', async () => {
    await resetLearningData(prisma);
    await M.seedStarterDeck(a, deck.slice(0, 10));
    expect(await M.seedStarterDeck(a, deck)).toBe(deck.length - 10);
    expect(await M.seedStarterDeck(a, deck)).toBe(0);
    expect(await a.item.count()).toBe(deck.length);
    expect(await a.srsState.count()).toBe(deck.length);
  });

  it('cả kho (khoảng 8.000 mục) vào được trong một lần', { timeout: 30_000 }, async () => {
    await resetLearningData(prisma);
    const full = await loadStarterDeck();
    expect(await M.seedStarterDeck(a, full)).toBe(full.length);
    expect(await a.srsState.count()).toBe(full.length);
  });
});
