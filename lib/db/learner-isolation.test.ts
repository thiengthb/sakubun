import { beforeAll, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser } from '@/lib/db/test-db';

// Roadmap 7.1: two learners on one database. A studies through the real app paths, then every
// read the app and the MCP tools make runs as B: no id of A may come back, and no write B sends
// with an id of A may change anything.

createTestDb('sakubun-isolation-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let a: UserDb;
let b: UserDb;

const NOW = new Date('2030-01-15T03:00:00.000Z');
const SENTENCE = {
  ja: '少し遅れたばかりに、電車に乗れなかった。',
  vi: 'Chỉ vì trễ một chút mà không lên được tàu.',
};

// Everything of A's, by id. Filled in beforeAll.
const ofA = { items: [] as string[], groups: [] as string[], turns: [] as string[] };
let aIds: string[] = [];

type Practice = typeof import('@/lib/library/practice');
type Groups = typeof import('@/lib/library/groups');
type Turn = typeof import('@/lib/app/turn');
type Quick = typeof import('@/lib/app/quick-review');
let P: Practice;
let G: Groups;
let T: Turn;
let Q: Quick;

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  const { userDb } = await import('@/lib/db/user-db');
  a = userDb(await createTestUser(prisma, 'learner-a'));
  b = userDb(await createTestUser(prisma, 'learner-b'));
  P = await import('@/lib/library/practice');
  G = await import('@/lib/library/groups');
  T = await import('@/lib/app/turn');
  Q = await import('@/lib/app/quick-review');

  // A: settings, grammar and vocab, a group, one graded turn, one quick-review answer.
  await P.saveSettings(a, { grammarLevels: ['N2'], dailyNewGrammar: 5, dailyNewVocab: 5 });
  await P.addItems(
    a,
    [{ expression: '〜ばかりに', meaningVi: 'chỉ vì', level: 'N2', notes: 'ghi chú của A' }],
    'MCP',
    'GRAMMAR',
  );
  await P.addItems(
    a,
    [{ expression: '急ぐ', reading: 'いそぐ', meaningVi: 'vội' }],
    'WEB',
    'VOCAB',
  );
  ofA.items = (await a.item.findMany({ select: { id: true } })).map((i) => i.id);
  const grammarA = (await a.item.findFirstOrThrow({ where: { kind: 'GRAMMAR' } })).id;
  const vocabA = (await a.item.findFirstOrThrow({ where: { kind: 'VOCAB' } })).id;
  const group = await G.createGroup(a, { name: 'Nhóm của A' });
  await G.addItemsToGroup(a, group.id, [grammarA]);
  ofA.groups = [group.id];
  const staged = await T.stageTurn(a, { itemId: grammarA, ...SENTENCE }, NOW);
  if (!staged.ok) throw new Error(staged.error);
  const graded = await T.gradeTurn(
    a,
    { turnId: staged.data.turnId, answer: 'chỉ vì trễ', rating: 3 },
    NOW,
  );
  if (!graded.ok) throw new Error(graded.error);
  ofA.turns = [staged.data.turnId];
  const answered = await Q.answerCard(a, { itemId: vocabA, mode: 'flip', rating: 3 }, NOW);
  if (!answered.ok) throw new Error(answered.error);

  // B: one item of its own, so empty results are not the only thing tested.
  await P.saveSettings(b, { grammarLevels: ['N2'], dailyNewGrammar: 5, dailyNewVocab: 5 });
  await P.addItems(b, [{ expression: '〜からには', meaningVi: 'một khi', level: 'N2' }], 'MCP');

  const srsA = await a.srsState.findMany({ select: { id: true } });
  const logsA = await a.reviewLog.findMany({ select: { id: true } });
  aIds = [...ofA.items, ...ofA.groups, ...ofA.turns, ...srsA, ...logsA].map((x) =>
    typeof x === 'string' ? x : x.id,
  );
  expect(logsA.length).toBe(2);
});

// Every id and every text of A that a leak would show.
function leaks(value: unknown): string[] {
  const text = JSON.stringify(value) ?? '';
  return [...aIds, '急ぐ', '〜ばかりに', 'ghi chú của A', 'Nhóm của A'].filter((s) =>
    text.includes(s),
  );
}

describe('two learners', () => {
  it('every rows A wrote carries A as owner', async () => {
    for (const model of [
      'item',
      'srsState',
      'reviewLog',
      'turn',
      'group',
      'groupMember',
      'settings',
    ] as const) {
      const rows = await (
        prisma[model] as unknown as { findMany: () => Promise<{ userId: string | null }[]> }
      ).findMany();
      const owners = new Set(rows.map((r) => r.userId));
      expect([...owners].sort(), model).toEqual(
        ['learner-a', 'learner-b'].filter((u) => owners.has(u)),
      );
      expect(owners.has(null), model).toBe(false);
    }
  });

  it("no read of B returns anything of A's", async () => {
    const { getQueue } = await import('@/lib/app/queue');
    const { getStatus } = await import('@/lib/app/status');
    const { findItems } = await import('@/lib/app/library');
    const { listHistory } = await import('@/lib/app/history');
    const { getReviewLoad } = await import('@/lib/library/review-load');
    const { getDashboard } = await import('@/lib/insights/dashboard');
    const { getItemStats } = await import('@/lib/insights/item-stats');
    const { getStreak } = await import('@/lib/insights/streak');
    const { exportUserData } = await import('@/lib/transfer/export');

    const reads: Record<string, unknown> = {
      settings: await P.getSettings(b),
      queue: await getQueue(b, NOW),
      status: await getStatus(b, NOW),
      quickReview: await Q.getQuickReview(b, NOW),
      itemCards: await Q.getItemCards(b, ofA.items, NOW),
      lookupGrammar: await findItems(b, 'ばかり'),
      lookupVocab: await findItems(b, '急'),
      history: await listHistory(b),
      grammar: await P.listItems(b, {}),
      vocab: await P.listItems(b, { kind: 'VOCAB' }),
      sentences: await P.listSentences(b),
      groups: await G.listGroups(b),
      group: await G.getGroup(b, ofA.groups[0]),
      addable: await G.listAddableItems(b, ofA.groups[0]),
      picker: await G.getItemGroupPicker(b, ofA.items[0]),
      reviewLoad: await getReviewLoad(b, 7, NOW),
      dashboard: await getDashboard(b, NOW),
      itemStats: await Promise.all(ofA.items.map((id) => getItemStats(b, id, NOW))),
      streak: await getStreak(b),
      export: await exportUserData(b),
    };

    for (const [name, value] of Object.entries(reads)) expect(leaks(value), name).toEqual([]);
    expect((await P.getSettings(b)).dailyNewGrammar).toBe(5);
    // The one answer that names A's ids echoes what B sent: every one not found.
    expect(await G.previewGroupMembers(b, 'mixed', ofA.items)).toEqual({
      fit: [],
      mismatched: [],
      notFound: ofA.items,
    });
  });

  it("no write of B changes anything of A's", async () => {
    const before = await snapshotA();
    const [grammarA] = ofA.items;
    const [groupA] = ofA.groups;
    const [turnA] = ofA.turns;

    await expect(P.setItemSuspended(b, grammarA, true)).rejects.toMatchObject({ code: 'P2025' });
    await expect(P.setItemStarred(b, grammarA, true)).rejects.toMatchObject({ code: 'P2025' });
    await expect(P.updateItem(b, grammarA, { meaningVi: 'đổi' })).rejects.toMatchObject({
      code: 'P2025',
    });
    await expect(P.deleteItem(b, grammarA)).rejects.toMatchObject({ code: 'P2025' });
    expect(await P.setItemsSuspended(b, ofA.items, true)).toEqual({ affected: 0 });
    expect(await P.deleteItems(b, ofA.items)).toEqual({ deleted: 0 });
    expect(await G.updateGroup(b, groupA, { name: 'đổi' })).toBe(false);
    expect(await G.deleteGroup(b, groupA)).toBe(false);
    await expect(G.addItemsToGroup(b, groupA, ofA.items)).rejects.toThrow(/not found/);
    expect(await G.removeItemsFromGroup(b, groupA, ofA.items)).toEqual({ removed: 0 });
    expect(await Q.answerCard(b, { itemId: grammarA, mode: 'flip', rating: 1 }, NOW)).toMatchObject(
      { ok: false },
    );
    expect(await T.nextTurn(b, { itemId: grammarA }, NOW)).toMatchObject({ ok: false });
    expect(await T.stageTurn(b, { itemId: grammarA, ...SENTENCE }, NOW)).toMatchObject({
      ok: false,
    });
    expect(
      await T.gradeTurn(b, { turnId: turnA, answer: 'x', rating: 1, errorTags: ['grammar'] }, NOW),
    ).toMatchObject({ ok: false });
    expect(await T.skipTurn(b, turnA)).toMatchObject({ ok: false });

    expect(await snapshotA()).toEqual(before);
  });
});

async function snapshotA() {
  return {
    items: await a.item.findMany({ orderBy: { id: 'asc' } }),
    srs: await a.srsState.findMany({ orderBy: { id: 'asc' } }),
    logs: await a.reviewLog.findMany({ orderBy: { id: 'asc' } }),
    turns: await a.turn.findMany({ orderBy: { id: 'asc' } }),
    groups: await a.group.findMany({ orderBy: { id: 'asc' } }),
    members: await a.groupMember.findMany({ orderBy: { itemId: 'asc' } }),
    settings: await a.settings.findMany(),
  };
}
