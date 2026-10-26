import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-app-turn-');

type Practice = typeof import('@/lib/library/practice');
type Turn = typeof import('@/lib/app/turn');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let T: Turn;
let prisma: Db['prisma'];
let db: UserDb;

const NOW = new Date('2030-01-15T03:00:00.000Z');

const SENTENCE = {
  ja: '少し遅れたばかりに、電車に乗れなかった。',
  vi: 'Chỉ vì trễ một chút mà không lên được tàu.',
};

async function seed(): Promise<{ grammar: string; vocab: string }> {
  await P.saveSettings(db, { grammarLevels: ['N2'], dailyNewGrammar: 5, dailyNewVocab: 5 });
  await P.addItems(
    db,
    [{ expression: '〜ばかりに', meaningVi: 'chỉ vì... (kết quả xấu)', level: 'N2' }],
    'MCP',
    'GRAMMAR',
  );
  await P.addItems(
    db,
    [{ expression: '急ぐ', reading: 'いそぐ', meaningVi: 'vội', level: 'N4' }],
    'MCP',
    'VOCAB',
  );
  const items = await db.item.findMany({ select: { id: true, kind: true } });
  return {
    grammar: items.find((i) => i.kind === 'GRAMMAR')!.id,
    vocab: items.find((i) => i.kind === 'VOCAB')!.id,
  };
}

async function staged(itemId: string): Promise<string> {
  const result = await T.stageTurn(db, { itemId, ...SENTENCE }, NOW);
  if (!result.ok) throw new Error(result.error);
  return result.data.turnId;
}

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  T = await import('@/lib/app/turn');
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('nextTurn', () => {
  it('serves the first queued item with how to write the sentence', async () => {
    const { grammar } = await seed();
    const result = await T.nextTurn(db, { hint: '  chủ đề du lịch ' }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.done) throw new Error('expected an item');
    expect(result.data.item).toMatchObject({
      itemId: grammar,
      expression: '〜ばかりに',
      isNew: true,
    });
    // New N2 item: Japanese to Vietnamese, pitched one level easier (N3 length).
    expect(result.data.spec).toMatchObject({ direction: 'JA_VI', lengthJa: [16, 28] });
    expect(result.data.card.meaning).toBe('chỉ vì... (kết quả xấu)');
    expect(result.data.hint).toBe('chủ đề du lịch');
  });

  it('serves a chosen item, and says done with the next due date when nothing is left', async () => {
    const { vocab } = await seed();
    const chosen = await T.nextTurn(db, { itemId: vocab }, NOW);
    expect(chosen.ok && !chosen.data.done && chosen.data.item.expression).toBe('急ぐ');

    await P.saveSettings(db, { dailyNewGrammar: 0, dailyNewVocab: 0 });
    const empty = await T.nextTurn(db, {}, NOW);
    expect(empty).toMatchObject({ ok: true, data: { done: true, nextDueAt: null } });
  });

  it('refuses an unknown or suspended item and names the fix', async () => {
    const { grammar } = await seed();
    expect(await T.nextTurn(db, { itemId: 'nope' }, NOW)).toMatchObject({ ok: false });
    await db.item.update({ where: { id: grammar }, data: { suspended: true } });
    const result = await T.nextTurn(db, { itemId: grammar }, NOW);
    expect(result).toEqual({
      ok: false,
      error: 'This item is suspended. Call next_turn for another one.',
    });
  });
});

describe('stageTurn', () => {
  it('stores the turn and returns the line the learner reads', async () => {
    const { grammar } = await seed();
    const result = await T.stageTurn(db, { itemId: grammar, ...SENTENCE }, NOW);
    expect(result).toMatchObject({ ok: true, data: { direction: 'JA_VI', show: SENTENCE.ja } });
    const turns = await db.turn.findMany();
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ itemId: grammar, status: 'staged', ja: SENTENCE.ja });
  });

  it('refuses a sentence without the target and writes nothing', async () => {
    const { grammar } = await seed();
    const result = await T.stageTurn(
      db,
      { itemId: grammar, ja: '少し遅れたせいで、電車に乗れなかった。', vi: SENTENCE.vi },
      NOW,
    );
    expect(result.ok).toBe(false);
    expect(await db.turn.count()).toBe(0);
  });

  it('allows the other direction only when the learner asked for it', async () => {
    const { grammar } = await seed();
    const silent = await T.stageTurn(db, { itemId: grammar, ...SENTENCE, direction: 'VI_JA' }, NOW);
    expect(silent.ok).toBe(false);
    const asked = await T.stageTurn(
      db,
      { itemId: grammar, ...SENTENCE, direction: 'VI_JA', hint: 'cho mình dịch Việt→Nhật' },
      NOW,
    );
    expect(asked).toMatchObject({ ok: true, data: { direction: 'VI_JA', show: SENTENCE.vi } });
  });

  it('replaces a turn that was staged but never answered', async () => {
    const { grammar } = await seed();
    const first = await staged(grammar);
    await staged(grammar);
    const statuses = await db.turn.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, status: true },
    });
    expect(statuses.map((t) => t.status).sort()).toEqual(['skipped', 'staged']);
    expect(statuses.find((t) => t.id === first)?.status).toBe('skipped');
  });
});

describe('gradeTurn', () => {
  it('records one review linked to the turn through recordReviews', async () => {
    const { grammar } = await seed();
    const turnId = await staged(grammar);
    const result = await T.gradeTurn(
      db,
      { turnId, answer: 'Chỉ vì trễ nên lỡ tàu.', rating: 3, feedback: 'Tốt.' },
      NOW,
    );
    expect(result).toMatchObject({ ok: true, data: { rating: 3, lowered: false } });

    const turn = await db.turn.findUniqueOrThrow({ where: { id: turnId } });
    expect(turn).toMatchObject({
      status: 'graded',
      rating: 3,
      answer: 'Chỉ vì trễ nên lỡ tàu.',
      gradedAt: NOW,
    });
    const logs = await db.reviewLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ itemId: grammar, turnId, channel: 'mcp', rating: 3 });
    expect((await db.srsState.findUniqueOrThrow({ where: { itemId: grammar } })).reps).toBe(1);
  });

  it('lowers Easy to Good after a hint', async () => {
    const { grammar } = await seed();
    const turnId = await staged(grammar);
    const result = await T.gradeTurn(db, { turnId, answer: 'x', rating: 4, hinted: true }, NOW);
    expect(result).toMatchObject({ ok: true, data: { rating: 3, lowered: true } });
  });

  it('grades once: a second grade or a skip is refused and writes nothing', async () => {
    const { grammar } = await seed();
    const turnId = await staged(grammar);
    await T.gradeTurn(db, { turnId, answer: 'x', rating: 3 }, NOW);
    const again = await T.gradeTurn(db, { turnId, answer: 'x', rating: 3 }, NOW);
    expect(again).toEqual({
      ok: false,
      error: 'Turn already graded. Call next_turn for a new one.',
    });
    expect((await T.skipTurn(db, turnId)).ok).toBe(false);
    expect(await db.reviewLog.count()).toBe(1);
  });

  it('two grades sent at once rate the item once', async () => {
    const { grammar } = await seed();
    const turnId = await staged(grammar);
    const results = await Promise.all([
      T.gradeTurn(db, { turnId, answer: 'x', rating: 3 }, NOW),
      T.gradeTurn(db, { turnId, answer: 'y', rating: 4 }, NOW),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      error: 'Turn already graded. Call next_turn for a new one.',
    });
    expect(await db.reviewLog.count()).toBe(1);
    expect((await db.srsState.findUniqueOrThrow({ where: { itemId: grammar } })).reps).toBe(1);
  });

  it('asks for error tags on a wrong answer and rejects unknown ones', async () => {
    const { grammar } = await seed();
    const turnId = await staged(grammar);
    const bare = await T.gradeTurn(db, { turnId, answer: 'x', rating: 1 }, NOW);
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.error).toContain('needs errorTags');
    const unknown = await T.gradeTurn(
      db,
      { turnId, answer: 'x', rating: 1, errorTags: ['typo'] },
      NOW,
    );
    expect(unknown.ok).toBe(false);
    expect(await db.reviewLog.count()).toBe(0);

    const tagged = await T.gradeTurn(
      db,
      { turnId, answer: 'x', rating: 1, errorTags: ['comprehension', 'comprehension'] },
      NOW,
    );
    expect(tagged.ok).toBe(true);
    const turn = await db.turn.findUniqueOrThrow({ where: { id: turnId } });
    expect(turn.errorTags).toBe('["comprehension"]');
  });

  it('refuses a bad rating, an empty answer and an unknown turn', async () => {
    const { grammar } = await seed();
    const turnId = await staged(grammar);
    expect((await T.gradeTurn(db, { turnId, answer: 'x', rating: 5 }, NOW)).ok).toBe(false);
    expect((await T.gradeTurn(db, { turnId, answer: '  ', rating: 3 }, NOW)).ok).toBe(false);
    expect((await T.gradeTurn(db, { turnId: 'nope', answer: 'x', rating: 3 }, NOW)).ok).toBe(false);
    expect(await db.reviewLog.count()).toBe(0);
  });
});

describe('skipTurn', () => {
  it('skips without touching the schedule', async () => {
    const { grammar } = await seed();
    const turnId = await staged(grammar);
    expect(await T.skipTurn(db, turnId)).toEqual({ ok: true, data: undefined });
    expect((await db.turn.findUniqueOrThrow({ where: { id: turnId } })).status).toBe('skipped');
    expect(await db.reviewLog.count()).toBe(0);
    expect((await db.srsState.findUniqueOrThrow({ where: { itemId: grammar } })).reps).toBe(0);
  });
});
