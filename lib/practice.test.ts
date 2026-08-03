// DB-backed regression net for the practice.ts core (P0.2 of plan 2026-07-24-optimization-maintainability-v2).
// It PINS the observable behavior of the functions later phases rewrite for performance — the FSRS write
// path (stage → submit), the stats/streak aggregates (P3.2 dedups their two unbounded ReviewLog scans),
// saveEnrichments (P3.4 batches its N+1), and addItems dedup — so a behavior-preserving refactor that
// changes the output fails loudly here. Same throwaway-DB harness as tenancy.test.ts: DATABASE_URL is set
// BEFORE lib/db is imported, so the guarded singleton binds to the temp DB, not dev.db.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { RatingValue } from '@/lib/srs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-practice-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Practice = typeof import('@/lib/practice');
type Db = typeof import('@/lib/db');
let P: Practice;
let prisma: Db['prisma'];

let seq = 0;
async function freshUser(): Promise<string> {
  const id = `u${seq++}`;
  await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
  return id;
}

/** Add one grammar item for `user` and return its itemId (addItems returns counts, not ids). */
async function addOneItem(user: string, expression: string, meaningVi = 'nghĩa'): Promise<string> {
  await P.addItems(user, [{ expression, meaningVi }]);
  const row = (await P.listItems(user)).find((i) => i.expression === expression);
  if (!row) throw new Error(`seed failed: ${expression}`);
  return row.itemId;
}

/** Stage a sentence targeting `itemId`, then grade it with `rating` (default Good). */
async function studyOnce(user: string, itemId: string, rating: RatingValue = 3, now = new Date()) {
  const { sentenceId } = await P.stageSentence(
    user,
    {
      direction: 'JA_VI',
      sourceText: '文',
      suggested: 'câu',
      items: [{ itemId, role: 'TARGET' }],
    },
    now,
  );
  return P.submitReview(
    user,
    { sentenceId, userAnswer: 'trả lời', ratings: [{ itemId, rating, role: 'TARGET' }] },
    now,
  );
}

beforeAll(async () => {
  P = await import('@/lib/practice');
  ({ prisma } = await import('@/lib/db'));
});

describe('submitReview — the FSRS write path', () => {
  it('writes exactly one ReviewLog and one advanced SrsState for the graded item', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'FSRS_pattern');

    const result = await studyOnce(u, itemId, 3);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].itemId).toBe(itemId);
    expect(result.items[0].nextDue instanceof Date).toBe(true);

    const logs = await prisma.reviewLog.count({ where: { userId: u } });
    expect(logs).toBe(1);

    const srs = await prisma.srsState.findFirst({ where: { itemId, userId: u } });
    expect(srs).not.toBeNull();
    expect(srs!.reps).toBe(1);
    expect(srs!.state).toBeGreaterThan(0); // left the "new" (0) state after a review
    expect(srs!.due.getTime()).toBeGreaterThan(0);
  });
});

describe('getStats / getStreak — the two aggregate paths must agree', () => {
  it('aggregates a known dataset and both streak computations match', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'STATS_pattern');
    const now = new Date();
    await studyOnce(u, itemId, 3, now);

    const stats = await P.getStats(u, now);
    expect(stats.totalItems).toBe(1);
    expect(stats.reviewsLast7Days).toBe(1);
    expect(stats.reviewsByDay).toHaveLength(7);
    expect(stats.reviewsByDay.at(-1)!.count).toBe(1); // today's bucket holds the one review
    const masterySansSuspended =
      stats.mastery.new + stats.mastery.learning + stats.mastery.review + stats.mastery.relearning;
    expect(masterySansSuspended).toBe(1);
    expect(stats.streak.current).toBeGreaterThanOrEqual(1);

    // P3.2 will dedup getStreak's separate unbounded scan into getStats — pin that they agree TODAY.
    const streak = await P.getStreak(u);
    expect(streak).toEqual(stats.streak);
  });

  it('a user with no reviews has a zero streak and an empty 7-day activity row', async () => {
    const u = await freshUser();
    const stats = await P.getStats(u);
    expect(stats.streak.current).toBe(0);
    expect(stats.reviewsLast7Days).toBe(0);
    expect(stats.reviewsByDay.every((d) => d.count === 0)).toBe(true);
  });
});

describe('saveEnrichments', () => {
  it('updates existing items and reports missing ones', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'ENRICH_pattern');

    const res = await P.saveEnrichments(u, [
      { itemId, enrichmentJson: '{"summary":"x"}' },
      { itemId: 'does-not-exist', enrichmentJson: '{}' },
    ]);
    expect(res.updated).toBe(1);
    expect(res.missing).toEqual(['does-not-exist']);

    const row = await prisma.item.findFirst({ where: { id: itemId, userId: u } });
    expect(row!.enrichment).toBe('{"summary":"x"}');
    expect(row!.enrichedAt).not.toBeNull();
  });
});

describe('a long aside cannot lose the pending sentence (plan 2026-07-26-agentic-tutor-loop step 2.5)', () => {
  it('a staged sentence auto-parked after the 1h window still grades with the SAME sentenceId', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'ASIDE_pending');
    const staged = new Date(Date.now() - 2 * 60 * 60 * 1000); // the aside ran long

    const { sentenceId } = await P.stageSentence(
      u,
      {
        direction: 'JA_VI',
        sourceText: '文',
        suggested: 'câu',
        items: [{ itemId, role: 'TARGET' }],
      },
      staged,
    );

    // What the aside triggers: any later read/write sweeps stale pendings into SKIPPED.
    expect((await P.autoSkipStalePending(u)).autoSkipped).toBe(1);
    const parked = await prisma.sentence.findFirst({ where: { id: sentenceId, userId: u } });
    expect(parked!.status).toBe('SKIPPED');

    // The answer arrives anyway. It MUST still grade: only a GRADED row is final, so the ratings and
    // the FSRS write are not lost, and the reference translation frozen at stage time is reused.
    const result = await P.submitReview(u, {
      sentenceId,
      userAnswer: 'trả lời muộn',
      ratings: [{ itemId, rating: 3, role: 'TARGET' }],
    });
    expect(result.suggested).toBe('câu');
    expect(result.items[0]?.rating).toBe(3);

    const row = await prisma.sentence.findFirst({ where: { id: sentenceId, userId: u } });
    expect(row!.status).toBe('GRADED');
    expect(row!.userAnswer).toBe('trả lời muộn'); // the auto-skip placeholder is replaced
    expect(await prisma.reviewLog.count({ where: { userId: u, itemId } })).toBe(1);
  });
});

describe('patchEnrichment — a merge that cannot destroy what is already there', () => {
  /** A complete v1 card, written straight to the column (the shape a real library row has). */
  const V1_CARD = JSON.stringify({
    v: 1,
    structure: ['動詞辞書形 + 〜ばかりに'],
    usage: 'Chỉ vì một việc nhỏ mà dẫn tới hậu quả xấu ngoài mong đợi.',
    collocations: ['一言言ったばかりに'],
    example: { ja: '一言言ったばかりに。', vi: 'Chỉ vì nói một câu.' },
    examples: [{ ja: '寝坊したばかりに。', vi: 'Chỉ vì ngủ quên.' }],
    pitfalls: ['Không dùng cho kết quả tốt.'],
    contrasts: [{ with: '〜せいで', note: 'Hối tiếc mạnh hơn.' }],
  });

  async function seedCarded(user: string, expression: string, card = V1_CARD): Promise<string> {
    const itemId = await addOneItem(user, expression);
    await P.saveEnrichments(user, [{ itemId, enrichmentJson: card }]);
    return itemId;
  }

  it('appends one contrast and keeps every other field — the operation enrich_items destroys', async () => {
    const u = await freshUser();
    const itemId = await seedCarded(u, 'PATCH_keeps');

    const res = await P.patchEnrichment(u, {
      itemId,
      add: { contrasts: [{ with: '〜おかげで', note: 'Kết quả tốt, ngược nghĩa.' }] },
    });
    expect(res.patched).toBe(true);

    const row = await prisma.item.findFirst({ where: { id: itemId, userId: u } });
    const after = JSON.parse(row!.enrichment!) as Record<string, unknown[]>;
    const before = JSON.parse(V1_CARD) as Record<string, unknown[]>;
    expect(after.contrasts).toHaveLength(2);
    expect(after.contrasts[0]).toEqual(before.contrasts[0]);
    expect(after.structure).toEqual(before.structure);
    expect(after.collocations).toEqual(before.collocations);
    expect(after.pitfalls).toEqual(before.pitfalls);
    expect(after.examples).toEqual(before.examples);
    // The card was already complete, so bringing it to the current format is just the stamp.
    expect((after as unknown as { v: number }).v).toBe(2);
  });

  it('refuses on an item with no readable card instead of inventing one', async () => {
    const u = await freshUser();
    const bare = await addOneItem(u, 'PATCH_nocard');
    expect(await P.patchEnrichment(u, { itemId: bare, add: { pitfalls: ['x'] } })).toEqual({
      patched: false,
      reason: 'no-card',
    });

    const broken = await seedCarded(u, 'PATCH_broken', '{"collocations":["x"]}');
    expect(await P.patchEnrichment(u, { itemId: broken, add: { pitfalls: ['x'] } })).toEqual({
      patched: false,
      reason: 'no-card',
    });
  });

  it("is scoped to the caller — another user's item is simply not found", async () => {
    const owner = await freshUser();
    const stranger = await freshUser();
    const itemId = await seedCarded(owner, 'PATCH_tenant');

    expect(await P.patchEnrichment(stranger, { itemId, add: { pitfalls: ['x'] } })).toEqual({
      patched: false,
      reason: 'not-found',
    });
    const row = await prisma.item.findFirst({ where: { id: itemId, userId: owner } });
    expect(row!.enrichment).toBe(V1_CARD); // untouched
  });

  it('reports a no-op rather than a success when everything sent is already on the card', async () => {
    const u = await freshUser();
    const itemId = await seedCarded(u, 'PATCH_noop', V1_CARD.replace('"v":1', '"v":2'));
    const res = await P.patchEnrichment(u, {
      itemId,
      add: { contrasts: [{ with: '「〜せいで」', note: 'Viết lại ghi chú.' }] },
    });
    expect(res).toEqual({ patched: false, reason: 'nothing-to-add' });
  });

  it('two concurrent patches never silently lose one of the two writes', async () => {
    const u = await freshUser();
    const itemId = await seedCarded(u, 'PATCH_race');

    const [a, b] = await Promise.all([
      P.patchEnrichment(u, { itemId, add: { pitfalls: ['Bẫy A.'] } }),
      P.patchEnrichment(u, { itemId, add: { pitfalls: ['Bẫy B.'] } }),
    ]);

    const row = await prisma.item.findFirst({ where: { id: itemId, userId: u } });
    const stored = row!.enrichment!;
    // Whichever way the two interleave, the outcome must be honest: either BOTH landed, or the loser
    // was TOLD it conflicted. What must never happen is a reported success whose content vanished.
    for (const [res, marker] of [
      [a, 'Bẫy A.'],
      [b, 'Bẫy B.'],
    ] as const) {
      if (res.patched) expect(stored).toContain(marker);
      else expect(res.reason).toBe('conflict');
    }
    expect(a.patched || b.patched).toBe(true);
  });

  it('merges from the CURRENT card, never a stale copy read earlier', async () => {
    const u = await freshUser();
    const itemId = await seedCarded(u, 'PATCH_conflict');

    // Simulate a second session finishing its own write between our read and our write by mutating the
    // column first, then patching from a report built on the ORIGINAL card.
    const stale = await prisma.item.findFirst({
      where: { id: itemId, userId: u },
      select: { enrichment: true },
    });
    await prisma.item.updateMany({
      where: { id: itemId, userId: u },
      data: { enrichment: V1_CARD.replace('Hối tiếc mạnh hơn.', 'Ghi chú của phiên khác.') },
    });
    expect(stale!.enrichment).toBe(V1_CARD);

    // The real guard: patching now succeeds (it re-reads), and the OTHER session's note survives —
    // proof the merge is built on current data rather than a stale copy.
    const res = await P.patchEnrichment(u, { itemId, add: { pitfalls: ['Bẫy mới.'] } });
    expect(res.patched).toBe(true);
    const row = await prisma.item.findFirst({ where: { id: itemId, userId: u } });
    expect(row!.enrichment).toContain('Ghi chú của phiên khác.');
  });

  it('takes the missing parts from a PUBLIC copy without touching my own usage', async () => {
    const me = await freshUser();
    const other = await freshUser();

    const thin = JSON.stringify({
      v: 2,
      structure: [],
      usage: 'Cách dùng CỦA TÔI, ngắn nhưng là của tôi.',
      collocations: [],
      example: { ja: 'わたしの例。', vi: 'Ví dụ của tôi.' },
      examples: [],
      pitfalls: [],
      contrasts: [],
    });
    const mine = await seedCarded(me, 'PATCH_shared', thin);
    const theirs = await seedCarded(other, 'PATCH_shared', V1_CARD);
    await (await import('@/lib/library')).publishItem(other, theirs);

    const res = await P.patchEnrichment(me, { itemId: mine, fromSharedItemId: theirs });
    expect(res.patched).toBe(true);

    const row = await prisma.item.findFirst({ where: { id: mine, userId: me } });
    const card = JSON.parse(row!.enrichment!) as {
      usage: string;
      example: { ja: string };
      pitfalls: string[];
      contrasts: { with: string }[];
      examples: { ja: string }[];
    };
    expect(card.usage).toBe('Cách dùng CỦA TÔI, ngắn nhưng là của tôi.'); // never taken from them
    expect(card.example.ja).toBe('わたしの例。');
    expect(card.pitfalls).toEqual(['Không dùng cho kết quả tốt.']);
    expect(card.contrasts.map((c) => c.with)).toEqual(['〜せいで']);
    // Their canonical example arrives as an extra, so my own stays canonical.
    expect(card.examples.map((e) => e.ja)).toContain('一言言ったばかりに。');
  });
});

describe('errorDetail — the confusion pair behind the tag (additive, no backfill)', () => {
  it('persists the pair, and a review WITHOUT one still writes exactly as before', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'DETAIL_dokoroka');

    const withPair = await P.stageSentence(u, {
      direction: 'VI_JA',
      sourceText: 'câu',
      suggested: '文',
      items: [{ itemId, role: 'TARGET' }],
    });
    await P.submitReview(u, {
      sentenceId: withPair.sentenceId,
      userAnswer: 'sai',
      ratings: [
        {
          itemId,
          rating: 2,
          role: 'TARGET',
          errorTags: ['word-choice'],
          errorDetail: [{ tag: 'word-choice', used: 'ほかに', required: '〜どころか' }],
        },
      ],
    });

    const without = await P.stageSentence(u, {
      direction: 'VI_JA',
      sourceText: 'câu 2',
      suggested: '文2',
      items: [{ itemId, role: 'TARGET' }],
    });
    await P.submitReview(u, {
      sentenceId: without.sentenceId,
      userAnswer: 'ok',
      ratings: [{ itemId, rating: 3, role: 'TARGET' }],
    });

    const logs = await prisma.reviewLog.findMany({
      where: { userId: u, itemId },
      orderBy: { rating: 'asc' },
    });
    expect(logs).toHaveLength(2);
    expect(JSON.parse(logs[0].errorDetail!)).toEqual([
      { tag: 'word-choice', used: 'ほかに', required: '〜どころか' },
    ]);
    // A review with nothing to pair stores NULL, not "[]" — indistinguishable from every pre-2026-07-27 row.
    expect(logs[1].errorDetail).toBeNull();
  });

  it('listConfusionRows returns only rows that carry a pair, with the item expression attached', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'DETAIL_rows');
    const { sentenceId } = await P.stageSentence(u, {
      direction: 'VI_JA',
      sourceText: 'câu',
      suggested: '文',
      items: [{ itemId, role: 'TARGET' }],
    });
    await P.submitReview(u, {
      sentenceId,
      userAnswer: 'sai',
      ratings: [
        {
          itemId,
          rating: 1,
          role: 'TARGET',
          errorTags: ['particle'],
          errorDetail: [{ used: 'に', required: 'で' }],
        },
      ],
    });
    // A second review with no detail must NOT appear in the mining input.
    await studyOnce(u, itemId, 3);

    const rows = await P.listConfusionRows(u);
    expect(rows).toHaveLength(1);
    expect(rows[0].expression).toBe('DETAIL_rows');
    expect(rows[0].sentenceId).toBe(sentenceId);
    expect(rows[0].confusions).toEqual([{ used: 'に', required: 'で' }]);
  });

  it('getWeakReport is unaffected — the flat tag still drives it', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'DETAIL_weak');
    const { sentenceId } = await P.stageSentence(u, {
      direction: 'VI_JA',
      sourceText: 'câu',
      suggested: '文',
      items: [{ itemId, role: 'TARGET' }],
    });
    await P.submitReview(u, {
      sentenceId,
      userAnswer: 'sai',
      ratings: [
        {
          itemId,
          rating: 1,
          role: 'TARGET',
          errorTags: ['particle'],
          errorDetail: [{ used: 'に', required: 'で' }],
        },
      ],
    });
    const report = await P.getWeakReport(u);
    expect(report.tagCounts.find((t) => t.tag === 'particle')?.count).toBe(1);
  });
});

describe('addItems — dedup', () => {
  it('skips a duplicate expression on re-add (idempotent), keeping one row', async () => {
    const u = await freshUser();
    const first = await P.addItems(u, [{ expression: 'DUP', meaningVi: 'a' }]);
    expect(first.created).toBe(1);

    const second = await P.addItems(u, [{ expression: 'DUP', meaningVi: 'b' }]);
    expect(second.created).toBe(0);
    expect(second.skipped.map((s) => s.expression)).toContain('DUP');

    const rows = await prisma.item.count({ where: { userId: u, kind: 'GRAMMAR' } });
    expect(rows).toBe(1);
  });
});

describe('calibration rides submitReview without touching FSRS', () => {
  it('seeds the ability row from the learner OWN settings, not a global default', async () => {
    const u = await freshUser();
    await P.saveSettings(u, { grammarLevels: ['N2'] });
    const itemId = await addOneItem(u, 'CAL_seed');

    await studyOnce(u, itemId, 3);

    const ability = await prisma.learnerAbility.findUnique({ where: { userId: u } });
    const other = await freshUser();
    await P.saveSettings(other, { grammarLevels: ['N5'] });
    const otherItem = await addOneItem(other, 'CAL_seed_low');
    await studyOnce(other, otherItem, 3);
    const otherAbility = await prisma.learnerAbility.findUnique({ where: { userId: other } });

    // The N2 learner starts rated higher than the N5 learner — the settings page IS the prior.
    expect(ability!.abilityReceptive).toBeGreaterThan(otherAbility!.abilityReceptive);
  });

  it('a graded turn moves ability + item challenge, and counts observations', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'CAL_move');

    const before = await prisma.item.findFirst({ where: { id: itemId, userId: u } });
    expect(before!.challenge).toBeNull(); // never measured yet — no backfill
    expect(before!.challengeObservations).toBe(0);

    await studyOnce(u, itemId, 4); // an easy win

    const after = await prisma.item.findFirst({ where: { id: itemId, userId: u } });
    const ability = await prisma.learnerAbility.findUnique({ where: { userId: u } });
    expect(after!.challenge).not.toBeNull();
    expect(after!.challengeObservations).toBe(1);
    // A JA_VI translation is RECEPTIVE evidence only — production must stay untouched.
    expect(ability!.receptiveObservations).toBe(1);
    expect(ability!.productiveObservations).toBe(0);
    expect(ability!.abilityProductive).toBe(ability!.abilityRegister);
  });

  it('FSRS values are IDENTICAL with calibration in the path (invariant 1)', async () => {
    // The guarantee that matters: calibration writes its own columns and nothing else. Two learners,
    // same rating sequence — their SrsState must match to the last float.
    const a = await freshUser();
    const b = await freshUser();
    const itemA = await addOneItem(a, 'CAL_fsrs');
    const itemB = await addOneItem(b, 'CAL_fsrs');
    const at = new Date('2026-07-26T09:00:00Z');

    for (const rating of [3, 4, 2] as RatingValue[]) {
      await studyOnce(a, itemA, rating, at);
      await studyOnce(b, itemB, rating, at);
    }

    const srsA = await prisma.srsState.findFirst({ where: { itemId: itemA, userId: a } });
    const srsB = await prisma.srsState.findFirst({ where: { itemId: itemB, userId: b } });
    expect(srsA!.stability).toBe(srsB!.stability);
    expect(srsA!.difficulty).toBe(srsB!.difficulty);
    expect(srsA!.reps).toBe(srsB!.reps);
    expect(srsA!.state).toBe(srsB!.state);
    // And FSRS difficulty is NOT the Elo challenge — two different numbers on two different rows.
    const itemRow = await prisma.item.findFirst({ where: { id: itemA, userId: a } });
    expect(itemRow!.challenge).not.toBe(srsA!.difficulty);
  });

  it('shadow mode proposes NOTHING on a thin history (no confident guess from 3 turns)', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'CAL_thin');
    const result = await studyOnce(u, itemId, 1); // a miss, but only one observation
    expect(result.calibration).toBe(null);
  });

  it('shadow mode proposes a change once there IS evidence, and applies nothing', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'CAL_evidence');
    const settingsBefore = await P.getSettings(u);

    // A long run of misses: well outside the dead band, well past the evidence floor.
    let last: Awaited<ReturnType<typeof studyOnce>> | null = null;
    for (let i = 0; i < 16; i += 1) last = await studyOnce(u, itemId, 1);

    expect(last!.calibration).not.toBe(null);
    expect(last!.calibration!.measured).toBeLessThan(0.75);
    expect(last!.calibration!.observations).toBeGreaterThanOrEqual(12);
    // SHADOW: the settings row is byte-for-byte unchanged.
    expect(await P.getSettings(u)).toEqual(settingsBefore);
  });
});

describe('listItems quality filter — the sweep needs a target list', () => {
  const OK = JSON.stringify({
    v: 2,
    structure: ['動詞 + X'],
    usage: 'Một câu giải thích đủ dài để vượt ngưỡng tối thiểu của thẻ.',
    collocations: [],
    example: { ja: 'あ', vi: 'a' },
    examples: [{ ja: 'い', vi: 'b' }],
    pitfalls: ['x'],
    contrasts: [{ with: 'y', note: 'z' }],
  });

  it('separates missing / broken / thin / ok, and needs-work spans the first three', async () => {
    const u = await freshUser();
    const bare = await addOneItem(u, 'Q_missing');
    const broken = await addOneItem(u, 'Q_broken');
    const thin = await addOneItem(u, 'Q_thin');
    const ok = await addOneItem(u, 'Q_ok');
    await P.saveEnrichments(u, [
      { itemId: broken, enrichmentJson: '{"collocations":["x"]}' },
      { itemId: thin, enrichmentJson: '{"usage":"Ngắn.","example":{"ja":"あ","vi":"a"}}' },
      { itemId: ok, enrichmentJson: OK },
    ]);

    const ids = async (quality: string) =>
      (await P.listItems(u, { quality: quality as never })).map((i) => i.itemId).sort();

    expect(await ids('missing')).toEqual([bare]);
    expect(await ids('broken')).toEqual([broken]);
    expect(await ids('thin')).toEqual([thin]);
    expect(await ids('ok')).toEqual([ok]);
    expect(await ids('needs-work')).toEqual([bare, broken, thin].sort());
    // `enriched: true` is exactly the blindness this filter fixes: it calls all three of those done.
    expect((await P.listItems(u, { enriched: true })).length).toBe(3);
  });

  it('applies the limit AFTER scoring, so it never filters just one page', async () => {
    const u = await freshUser();
    // 3 carded items first, then 2 without — with limit applied BEFORE scoring, asking for the two
    // uncarded ones with limit 2 would return nothing.
    for (const name of ['P_a', 'P_b', 'P_c']) {
      const id = await addOneItem(u, name);
      await P.saveEnrichments(u, [{ itemId: id, enrichmentJson: OK }]);
    }
    await addOneItem(u, 'P_gap1');
    await addOneItem(u, 'P_gap2');

    const found = await P.listItems(u, { quality: 'missing', limit: 2 });
    expect(found.map((i) => i.expression).sort()).toEqual(['P_gap1', 'P_gap2']);
  });
});

describe('getLibraryHealth — the whole-kho aggregate', () => {
  it('counts card quality, below-target items and the weak cluster from real rows', async () => {
    const { getLibraryHealth } = await import('@/lib/library-health');
    const u = await freshUser();
    await P.saveSettings(u, { grammarLevels: ['N3'] });

    // addItems defaults to N5, so the studied-level item must say N3 explicitly.
    await P.addItems(u, [{ expression: 'H_studied', meaningVi: 'x', level: 'N3' }]);
    await P.addItems(u, [{ expression: 'H_easy', meaningVi: 'x', level: 'N5' }]);

    const health = (await getLibraryHealth(u)).health;
    expect(health.totals.grammar).toBe(2);
    expect(health.quality.missing).toBe(2);
    // Only the STUDIED level is reported as a gap — an N5 item is not a hole in an N3 curriculum.
    expect(health.byStudiedLevel).toEqual([{ level: 'N3', total: 1, needsWork: 1 }]);
    // N5 is easier than the N3 target and not suspended → it is queue the learner grinds through.
    expect(health.belowTargetActive).toBe(1);
    // No reviews yet → a percentage would be noise, and the verdict says so instead.
    expect(health.retention.measured).toBeNull();
    expect(health.weakCluster).toBeNull();
  });
});

/**
 * TEACH_BACK (plan step 7.1) — the fourth exercise type. The claim being pinned is "no new write path":
 * a graded explanation must travel the SAME stage → submit → FSRS road as a translation, with no schema
 * change and no second scheduler. If that stops being true, the mode has quietly become a fork of the
 * practice loop and invariant 1 is gone.
 */
describe('TEACH_BACK reuses the practice pipeline exactly', () => {
  /** Stage + grade one explanation, the way TEACH_BACK_PROTOCOL says to. */
  async function teachBackOnce(
    user: string,
    itemId: string,
    o: { rating?: RatingValue; explanation?: string } = {},
  ) {
    const { sentenceId } = await P.stageSentence(user, {
      direction: 'JA_VI',
      exerciseType: P.TEACH_BACK_EXERCISE,
      sourceText: '〜ばかりに',
      suggested: 'Gắn sau động từ thể từ điển; chỉ vì một chuyện nhỏ mà ra kết quả xấu.',
      items: [{ itemId, role: 'TARGET' }],
    });
    return P.submitReview(user, {
      sentenceId,
      userAnswer:
        o.explanation ??
        'Mẫu này gắn sau động từ thể từ điển, diễn tả chỉ vì một chuyện nhỏ mà dẫn tới hậu quả xấu ' +
          'ngoài ý muốn, thường mang giọng tiếc nuối.',
      ratings: [{ itemId, rating: o.rating ?? 4, role: 'TARGET' }],
    });
  }

  it('writes exactly one ReviewLog and advances the SrsState, like any other turn', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'TB_pattern');

    const result = await teachBackOnce(u, itemId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].itemId).toBe(itemId);
    expect(await prisma.reviewLog.count({ where: { userId: u, itemId } })).toBe(1);
    const srs = await prisma.srsState.findFirst({ where: { userId: u, itemId } });
    expect(srs?.state).not.toBe(0); // no longer "new" — it went through the scheduler
    const sentence = await prisma.sentence.findFirst({
      where: { id: result.sentenceId, userId: u },
    });
    expect(sentence?.exerciseType).toBe('TEACH_BACK');
    expect(sentence?.status).toBe('GRADED');
  });

  it('counts as RECEPTIVE evidence — no Japanese was produced, so productive must not move', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'TB_axis');

    await teachBackOnce(u, itemId);

    const after = await prisma.learnerAbility.findUnique({ where: { userId: u } });
    expect(after!.receptiveObservations).toBe(1);
    expect(after!.productiveObservations).toBe(0);
    expect(after!.registerObservations).toBe(0);
    // The two untouched axes are still at the seed the settings implied — nothing moved them.
    expect(after!.abilityProductive).toBe(after!.abilityRegister);
  });

  it('offers the explanation to a card-less pattern, and stays silent once a card exists', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'TB_harvest');

    const harvested = await teachBackOnce(u, itemId);
    expect(harvested.teachBack).toMatchObject({ itemId, expression: 'TB_harvest', rating: 4 });
    expect(harvested.teachBack!.usage).toContain('tiếc nuối');

    await P.saveEnrichments(u, [
      {
        itemId,
        enrichmentJson: JSON.stringify({
          usage: 'Đã có cách dùng sẵn trên thẻ.',
          example: { ja: '行ったばかりに。', vi: 'Chỉ vì đã đi.' },
        }),
      },
    ]);
    expect((await teachBackOnce(u, itemId)).teachBack).toBeNull();
  });

  it('never harvests a poor explanation — a wrong card is worse than no card', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'TB_poor');
    const result = await teachBackOnce(u, itemId, {
      rating: 1,
      explanation: 'Hình như nó nghĩa là "chỉ vì", mà tôi không nhớ gắn vào đâu, chắc là danh từ.',
      // errorTags are the protocol's job at rating <= 2; the harvest bar is the rating itself.
    });
    expect(result.teachBack).toBeNull();
  });

  it('a TRANSLATION turn never produces a harvest, however well it was graded', async () => {
    const u = await freshUser();
    const itemId = await addOneItem(u, 'TB_not_teachback');
    // Same rating, same card-less item — only the exerciseType differs.
    expect((await studyOnce(u, itemId, 4)).teachBack).toBeNull();
  });
});
