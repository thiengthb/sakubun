import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-app-quick-');

type Practice = typeof import('@/lib/library/practice');
type Quick = typeof import('@/lib/app/quick-review');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let Q: Quick;
let prisma: Db['prisma'];

const NOW = new Date('2030-01-15T03:00:00.000Z');
const DAY = 86_400_000;

const ENRICHMENT = JSON.stringify({
  structure: ['N + を約束する'],
  usage: 'hứa',
  example: {
    ja: '友達と約束をしました。',
    vi: 'Tôi đã hẹn với bạn.',
    jaRuby: '友達[ともだち]と約束[やくそく]をしました。',
  },
  pitfalls: ['Không dùng cho lịch hẹn khám bệnh.'],
});

async function seed(
  rows: { expression: string; level?: string; notes?: string }[],
  kind: 'GRAMMAR' | 'VOCAB' = 'VOCAB',
): Promise<Record<string, string>> {
  await P.addItems(
    rows.map((r) => ({ meaningVi: 'nghĩa', level: 'N5', ...r })),
    'MCP',
    kind,
  );
  const found = await prisma.item.findMany({ select: { id: true, expression: true } });
  return Object.fromEntries(found.map((r) => [r.expression, r.id]));
}

async function makeSeen(itemId: string): Promise<void> {
  await prisma.srsState.update({
    where: { itemId },
    data: {
      state: 2,
      due: new Date(NOW.getTime() - DAY),
      lastReview: new Date(NOW.getTime() - 4 * DAY),
      stability: 4,
      difficulty: 5,
      scheduledDays: 3,
      reps: 3,
    },
  });
}

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  Q = await import('@/lib/app/quick-review');
  ({ prisma } = await import('@/lib/db/db'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('getQuickReview', () => {
  it('meets a new item on a flip card, its example sentence underlining it', async () => {
    const ids = await seed([{ expression: '約束' }]);
    await prisma.item.update({ where: { id: ids['約束'] }, data: { enrichment: ENRICHMENT } });

    const [card] = (await Q.getQuickReview(NOW)).cards;
    expect(card).toMatchObject({
      mode: 'flip',
      isNew: true,
      structure: 'N + を約束する',
      note: 'Không dùng cho lịch hẹn khám bệnh.',
    });
    expect(card.sentence?.translation).toBe('Tôi đã hẹn với bạn.');
    expect(card.sentence?.segments).toContainEqual({
      text: '約束',
      reading: 'やくそく',
      mark: 'target',
    });
    expect(card.dueIfRight.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('tests a seen item with a cloze: four choices, the answer not in the sentence', async () => {
    const ids = await seed([
      { expression: '約束' },
      { expression: '準備' },
      { expression: '練習' },
      { expression: '連絡' },
    ]);
    await prisma.item.update({ where: { id: ids['約束'] }, data: { enrichment: ENRICHMENT } });
    await makeSeen(ids['約束']);

    const card = (await Q.getQuickReview(NOW)).cards.find((c) => c.itemId === ids['約束'])!;
    expect(card.mode).toBe('cloze');
    if (card.mode !== 'cloze') return;
    expect(card.choices.map((c) => c.itemId).sort()).toEqual(Object.values(ids).sort());
    expect(card.sentence.segments).toContainEqual({ text: '', mark: 'blank' });
    expect(JSON.stringify(card.sentence.segments)).not.toMatch(/約束|やくそく/);
  });

  it('falls back to a flip card when no sentence can be blanked', async () => {
    const ids = await seed([
      {
        expression: '急ぐ',
        notes: 'EN: hurry · Ví dụ: ニックはバスに間に合うように急いだ。 (Nick hurried.)',
      },
      { expression: '準備' },
      { expression: '練習' },
      { expression: '連絡' },
    ]);
    await makeSeen(ids['急ぐ']);

    const card = (await Q.getQuickReview(NOW)).cards.find((c) => c.itemId === ids['急ぐ'])!;
    expect(card.mode).toBe('flip');
    // The conjugated form is still found and underlined; OpenJLPT gives no Vietnamese translation.
    expect(card.sentence?.segments).toContainEqual({ text: '急', mark: 'target' });
    expect(card.sentence?.translation).toBeNull();
  });

  it('shows the same cards when reloaded the same day', async () => {
    const ids = await seed([
      { expression: '約束' },
      { expression: '準備' },
      { expression: '練習' },
      { expression: '連絡' },
      { expression: '相談' },
    ]);
    await prisma.item.update({ where: { id: ids['約束'] }, data: { enrichment: ENRICHMENT } });
    await makeSeen(ids['約束']);
    expect(await Q.getQuickReview(NOW)).toEqual(await Q.getQuickReview(NOW));
  });
});

describe('answerCard', () => {
  it('records a remembered flip as Good, once; a second tap is refused', async () => {
    const ids = await seed([{ expression: '約束' }]);
    const itemId = ids['約束'];

    const first = await Q.answerCard({ itemId, mode: 'flip', remembered: true }, NOW);
    expect(first).toMatchObject({ ok: true, data: { rating: 3, correct: true } });
    const again = await Q.answerCard({ itemId, mode: 'flip', remembered: true }, NOW);
    expect(again.ok).toBe(false);

    expect(await prisma.reviewLog.count({ where: { itemId } })).toBe(1);
    expect((await prisma.srsState.findUniqueOrThrow({ where: { itemId } })).reps).toBe(1);
  });

  it('grades a cloze by the chosen item: a wrong choice is Again', async () => {
    const ids = await seed([{ expression: '約束' }, { expression: '準備' }]);
    await makeSeen(ids['約束']);

    const wrong = await Q.answerCard(
      { itemId: ids['約束'], mode: 'cloze', choiceId: ids['準備'] },
      NOW,
    );
    expect(wrong).toMatchObject({ ok: true, data: { rating: 1, correct: false } });
    const log = await prisma.reviewLog.findFirstOrThrow({ where: { itemId: ids['約束'] } });
    expect(log).toMatchObject({ rating: 1, state: 2, channel: 'web', turnId: null });
  });

  it('refuses a suspended item and writes nothing', async () => {
    const ids = await seed([{ expression: '約束' }]);
    await P.setItemSuspended(ids['約束'], true);
    const result = await Q.answerCard({ itemId: ids['約束'], mode: 'flip', remembered: true }, NOW);
    expect(result.ok).toBe(false);
    expect(await prisma.reviewLog.count()).toBe(0);
  });
});

describe('getItemCards', () => {
  it('shows chosen items as flip cards in the given order, seen or not, and grades nothing', async () => {
    const ids = await seed([{ expression: '約束' }, { expression: '準備' }]);
    await prisma.item.update({ where: { id: ids['約束'] }, data: { enrichment: ENRICHMENT } });
    await makeSeen(ids['約束']);

    const cards = await Q.getItemCards([ids['準備'], 'missing', ids['約束']], NOW);
    expect(cards.map((c) => [c.itemId, c.mode, c.isNew])).toEqual([
      [ids['準備'], 'flip', true],
      [ids['約束'], 'flip', false],
    ]);
    expect(cards[1].sentence?.segments).toContainEqual({
      text: '約束',
      reading: 'やくそく',
      mark: 'target',
    });
    expect(await prisma.reviewLog.count()).toBe(0);
  });
});
