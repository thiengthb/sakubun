import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';
import { CURRENT_ENRICHMENT_VERSION } from '@/lib/library/enrichment';
import type { RatingValue } from '@/lib/srs/srs';

createTestDb('sakubun-practice-');

type Practice = typeof import('@/lib/library/practice');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let prisma: Db['prisma'];

async function resetData(): Promise<void> {
  await resetLearningData(prisma);
  P.invalidateStreak();
}

async function addOneItem(expression: string, kind = 'GRAMMAR'): Promise<string> {
  await P.addItems([{ expression, meaningVi: 'nghĩa' }], 'MCP', kind);
  const row = (await P.listItems({ kind })).find((i) => i.expression === expression);
  if (!row) throw new Error(`seed failed: ${expression}`);
  return row.itemId;
}

async function studyOnce(itemId: string, rating: RatingValue = 3, now = new Date()) {
  const { sentenceId } = await P.stageSentence(
    {
      direction: 'JA_VI',
      sourceText: '文',
      suggested: 'câu',
      items: [{ itemId, role: 'TARGET' }],
    },
    now,
  );
  return P.submitReview(
    { sentenceId, userAnswer: 'trả lời', ratings: [{ itemId, rating, role: 'TARGET' }] },
    now,
  );
}

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  ({ prisma } = await import('@/lib/db/db'));
});

describe('submitReview — the FSRS write path', () => {
  it('writes exactly one ReviewLog and one advanced SrsState for the graded item', async () => {
    await resetData();
    const itemId = await addOneItem('FSRS_pattern');

    const result = await studyOnce(itemId, 3);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].itemId).toBe(itemId);
    expect(result.items[0].nextDue instanceof Date).toBe(true);

    const logs = await prisma.reviewLog.count({ where: {} });
    expect(logs).toBe(1);

    const srs = await prisma.srsState.findFirst({ where: { itemId } });
    expect(srs).not.toBeNull();
    expect(srs!.reps).toBe(1);
    expect(srs!.state).toBeGreaterThan(0); // left the "new" (0) state after a review
    expect(srs!.due.getTime()).toBeGreaterThan(0);
  });
});

describe('getStats / getStreak — the two aggregate paths must agree', () => {
  it('aggregates a known dataset and both streak computations match', async () => {
    await resetData();
    const itemId = await addOneItem('STATS_pattern');
    const now = new Date();
    await studyOnce(itemId, 3, now);

    const stats = await P.getStats(now);
    expect(stats.totalItems).toBe(1);
    expect(stats.reviewsLast7Days).toBe(1);
    expect(stats.reviewsByDay).toHaveLength(7);
    expect(stats.reviewsByDay.at(-1)!.count).toBe(1); // today's bucket holds the one review
    const masterySansSuspended =
      stats.mastery.new + stats.mastery.learning + stats.mastery.review + stats.mastery.relearning;
    expect(masterySansSuspended).toBe(1);
    expect(stats.streak.current).toBeGreaterThanOrEqual(1);

    const streak = await P.getStreak();
    expect(streak).toEqual(stats.streak);
  });

  it('a user with no reviews has a zero streak and an empty 7-day activity row', async () => {
    await resetData();
    const stats = await P.getStats();
    expect(stats.streak.current).toBe(0);
    expect(stats.reviewsLast7Days).toBe(0);
    expect(stats.reviewsByDay.every((d) => d.count === 0)).toBe(true);
  });
});

describe('saveEnrichments', () => {
  it('updates existing items and reports missing ones', async () => {
    await resetData();
    const itemId = await addOneItem('ENRICH_pattern');

    const res = await P.saveEnrichments([
      { itemId, enrichmentJson: '{"summary":"x"}' },
      { itemId: 'does-not-exist', enrichmentJson: '{}' },
    ]);
    expect(res.updated).toBe(1);
    expect(res.missing).toEqual(['does-not-exist']);

    const row = await prisma.item.findFirst({ where: { id: itemId } });
    expect(row!.enrichment).toBe('{"summary":"x"}');
    expect(row!.enrichedAt).not.toBeNull();
  });

  it('a COMPLETE card is stamped with the current format version by the SERVER', async () => {
    await resetData();
    const itemId = await addOneItem('ENRICH_stamp');
    const complete = JSON.stringify({
      structure: ['動詞辞書形 + 〜わけだ'],
      usage: 'Dùng khi rút ra một kết luận hợp lý từ điều vừa mới biết.',
      collocations: ['そういうわけだ'],
      example: { ja: '道が混んでいるわけだ。', vi: 'Thì ra là đường đang tắc.' },
      examples: [{ ja: '寝ていたわけだ。', vi: 'Thì ra là đang ngủ.' }],
      pitfalls: ['Không lẫn với 〜はずだ.'],
      contrasts: [{ with: '〜はずだ', note: '〜はずだ là suy đoán, 〜わけだ là kết luận.' }],
    });
    await P.saveEnrichments([{ itemId, enrichmentJson: complete }]);

    const row = await prisma.item.findFirst({ where: { id: itemId } });
    const stored = JSON.parse(row!.enrichment!) as { v: number };
    expect(stored.v).toBe(CURRENT_ENRICHMENT_VERSION);

    const ids = (await P.listItems({ quality: 'needs-work' })).map((r) => r.itemId);
    expect(ids).not.toContain(itemId);
  });

  it('an INCOMPLETE card is NOT stamped — thin must keep reading as thin', async () => {
    await resetData();
    const itemId = await addOneItem('ENRICH_nostamp');
    await P.saveEnrichments([
      {
        itemId,
        enrichmentJson: JSON.stringify({
          usage: 'Một dòng cách dùng đủ dài để vượt ngưỡng tối thiểu của thẻ.',
          example: { ja: 'あ', vi: 'a' },
        }),
      },
    ]);

    const row = await prisma.item.findFirst({ where: { id: itemId } });
    expect(row!.enrichment).not.toContain('"v"');
    expect((await P.listItems({ quality: 'thin' })).map((r) => r.itemId)).toContain(itemId);
  });

  it('a VOCAB card is stamped against the VOCAB bar, not the grammar one', async () => {
    await resetData();
    const wordId = await addOneItem('ENRICH_word', 'VOCAB');
    await P.saveEnrichments([
      {
        itemId: wordId,
        enrichmentJson: JSON.stringify({
          usage: 'Việc chuẩn bị trước cho một việc cụ thể; trung tính.',
          collocations: ['準備をする', '準備が整う'],
          example: { ja: '会議の準備をしています。', vi: 'Tôi đang chuẩn bị cho cuộc họp.' },
          examples: [{ ja: '準備が整いました。', vi: 'Đã chuẩn bị xong.' }],
          pitfalls: ['Không nhầm với 用意.'],
          synonyms: [{ term: '用意', reading: 'ようい', vi: 'sự sắm sẵn' }],
        }),
      },
    ]);

    const row = await prisma.item.findFirst({ where: { id: wordId } });
    expect((JSON.parse(row!.enrichment!) as { v: number }).v).toBe(CURRENT_ENRICHMENT_VERSION);
    expect((await P.listItems({ kind: 'VOCAB', quality: 'needs-work' })).length).toBe(0);
  });
});

describe('a long aside cannot lose the pending sentence (plan 2026-07-26-agentic-tutor-loop step 2.5)', () => {
  it('a staged sentence auto-parked after the 1h window still grades with the SAME sentenceId', async () => {
    await resetData();
    const itemId = await addOneItem('ASIDE_pending');
    const staged = new Date(Date.now() - 2 * 60 * 60 * 1000); // the aside ran long

    const { sentenceId } = await P.stageSentence(
      {
        direction: 'JA_VI',
        sourceText: '文',
        suggested: 'câu',
        items: [{ itemId, role: 'TARGET' }],
      },
      staged,
    );

    expect((await P.autoSkipStalePending()).autoSkipped).toBe(1);
    const parked = await prisma.sentence.findFirst({ where: { id: sentenceId } });
    expect(parked!.status).toBe('SKIPPED');

    const result = await P.submitReview({
      sentenceId,
      userAnswer: 'trả lời muộn',
      ratings: [{ itemId, rating: 3, role: 'TARGET' }],
    });
    expect(result.suggested).toBe('câu');
    expect(result.items[0]?.rating).toBe(3);

    const row = await prisma.sentence.findFirst({ where: { id: sentenceId } });
    expect(row!.status).toBe('GRADED');
    expect(row!.userAnswer).toBe('trả lời muộn'); // the auto-skip placeholder is replaced
    expect(await prisma.reviewLog.count({ where: { itemId } })).toBe(1);
  });
});

describe('patchEnrichment — a merge that cannot destroy what is already there', () => {
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

  async function seedCarded(expression: string, card = V1_CARD): Promise<string> {
    const itemId = await addOneItem(expression);
    await prisma.item.update({ where: { id: itemId }, data: { enrichment: card } });
    return itemId;
  }

  it('appends one contrast and keeps every other field — the operation enrich_items destroys', async () => {
    await resetData();
    const itemId = await seedCarded('PATCH_keeps');

    const res = await P.patchEnrichment({
      itemId,
      add: { contrasts: [{ with: '〜おかげで', note: 'Kết quả tốt, ngược nghĩa.' }] },
    });
    expect(res.patched).toBe(true);

    const row = await prisma.item.findFirst({ where: { id: itemId } });
    const after = JSON.parse(row!.enrichment!) as Record<string, unknown[]>;
    const before = JSON.parse(V1_CARD) as Record<string, unknown[]>;
    expect(after.contrasts).toHaveLength(2);
    expect(after.contrasts[0]).toEqual(before.contrasts[0]);
    expect(after.structure).toEqual(before.structure);
    expect(after.collocations).toEqual(before.collocations);
    expect(after.pitfalls).toEqual(before.pitfalls);
    expect(after.examples).toEqual(before.examples);
    expect((after as unknown as { v: number }).v).toBe(CURRENT_ENRICHMENT_VERSION);
  });

  it('refuses on an item with no readable card instead of inventing one', async () => {
    await resetData();
    const bare = await addOneItem('PATCH_nocard');
    expect(await P.patchEnrichment({ itemId: bare, add: { pitfalls: ['x'] } })).toEqual({
      patched: false,
      reason: 'no-card',
    });

    const broken = await seedCarded('PATCH_broken', '{"collocations":["x"]}');
    expect(await P.patchEnrichment({ itemId: broken, add: { pitfalls: ['x'] } })).toEqual({
      patched: false,
      reason: 'no-card',
    });
  });

  it('reports a no-op rather than a success when everything sent is already on the card', async () => {
    await resetData();
    const itemId = await seedCarded(
      'PATCH_noop',
      V1_CARD.replace('"v":1', `"v":${CURRENT_ENRICHMENT_VERSION}`),
    );
    const res = await P.patchEnrichment({
      itemId,
      add: { contrasts: [{ with: '「〜せいで」', note: 'Viết lại ghi chú.' }] },
    });
    expect(res).toEqual({ patched: false, reason: 'nothing-to-add' });
  });

  it('two concurrent patches never silently lose one of the two writes', async () => {
    await resetData();
    const itemId = await seedCarded('PATCH_race');

    const [a, b] = await Promise.all([
      P.patchEnrichment({ itemId, add: { pitfalls: ['Bẫy A.'] } }),
      P.patchEnrichment({ itemId, add: { pitfalls: ['Bẫy B.'] } }),
    ]);

    const row = await prisma.item.findFirst({ where: { id: itemId } });
    const stored = row!.enrichment!;
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
    await resetData();
    const itemId = await seedCarded('PATCH_conflict');

    const stale = await prisma.item.findFirst({
      where: { id: itemId },
      select: { enrichment: true },
    });
    await prisma.item.updateMany({
      where: { id: itemId },
      data: { enrichment: V1_CARD.replace('Hối tiếc mạnh hơn.', 'Ghi chú của phiên khác.') },
    });
    expect(stale!.enrichment).toBe(V1_CARD);

    const res = await P.patchEnrichment({ itemId, add: { pitfalls: ['Bẫy mới.'] } });
    expect(res.patched).toBe(true);
    const row = await prisma.item.findFirst({ where: { id: itemId } });
    expect(row!.enrichment).toContain('Ghi chú của phiên khác.');
  });

});

describe('errorDetail — the confusion pair behind the tag (additive, no backfill)', () => {
  it('persists the pair, and a review WITHOUT one still writes exactly as before', async () => {
    await resetData();
    const itemId = await addOneItem('DETAIL_dokoroka');

    const withPair = await P.stageSentence({
      direction: 'VI_JA',
      sourceText: 'câu',
      suggested: '文',
      items: [{ itemId, role: 'TARGET' }],
    });
    await P.submitReview({
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

    const without = await P.stageSentence({
      direction: 'VI_JA',
      sourceText: 'câu 2',
      suggested: '文2',
      items: [{ itemId, role: 'TARGET' }],
    });
    await P.submitReview({
      sentenceId: without.sentenceId,
      userAnswer: 'ok',
      ratings: [{ itemId, rating: 3, role: 'TARGET' }],
    });

    const logs = await prisma.reviewLog.findMany({
      where: { itemId },
      orderBy: { rating: 'asc' },
    });
    expect(logs).toHaveLength(2);
    expect(JSON.parse(logs[0].errorDetail!)).toEqual([
      { tag: 'word-choice', used: 'ほかに', required: '〜どころか' },
    ]);
    expect(logs[1].errorDetail).toBeNull();
  });

  it('listConfusionRows returns only rows that carry a pair, with the item expression attached', async () => {
    await resetData();
    const itemId = await addOneItem('DETAIL_rows');
    const { sentenceId } = await P.stageSentence({
      direction: 'VI_JA',
      sourceText: 'câu',
      suggested: '文',
      items: [{ itemId, role: 'TARGET' }],
    });
    await P.submitReview({
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
    await studyOnce(itemId, 3);

    const rows = await P.listConfusionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].expression).toBe('DETAIL_rows');
    expect(rows[0].sentenceId).toBe(sentenceId);
    expect(rows[0].confusions).toEqual([{ used: 'に', required: 'で' }]);
  });

  it('getWeakReport is unaffected — the flat tag still drives it', async () => {
    await resetData();
    const itemId = await addOneItem('DETAIL_weak');
    const { sentenceId } = await P.stageSentence({
      direction: 'VI_JA',
      sourceText: 'câu',
      suggested: '文',
      items: [{ itemId, role: 'TARGET' }],
    });
    await P.submitReview({
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
    const report = await P.getWeakReport();
    expect(report.tagCounts.find((t) => t.tag === 'particle')?.count).toBe(1);
  });
});

describe('addItems — dedup', () => {
  it('skips a duplicate expression on re-add (idempotent), keeping one row', async () => {
    await resetData();
    const first = await P.addItems([{ expression: 'DUP', meaningVi: 'a' }]);
    expect(first.created).toBe(1);

    const second = await P.addItems([{ expression: 'DUP', meaningVi: 'b' }]);
    expect(second.created).toBe(0);
    expect(second.skipped.map((s) => s.expression)).toContain('DUP');

    const rows = await prisma.item.count({ where: { kind: 'GRAMMAR' } });
    expect(rows).toBe(1);
  });

  it('refuses an expression that is only punctuation, for GRAMMAR as well as VOCAB', async () => {
    await resetData();
    // Found by driving a real MCP session: cleanVocabTerm only runs for VOCAB, so these survived
    // cleanText with length > 0 and became scheduled grammar items the learner was then asked to
    // translate.
    for (const junk of ['（　）', '「」', '…', '〜', '   ']) {
      const res = await P.addItems([{ expression: junk, meaningVi: 'rác' }]);
      expect(res.created, `"${junk}" must not enter the library`).toBe(0);
      expect(res.skipped).toHaveLength(1);
    }
    expect(await prisma.item.count({ where: { kind: 'GRAMMAR' } })).toBe(0);
  });

  it('still accepts a real pattern that merely STARTS with 〜', async () => {
    await resetData();
    const res = await P.addItems([{ expression: '〜ばかりに', meaningVi: 'chỉ vì' }]);
    expect(res.created).toBe(1);
  });
});

describe('calibration rides submitReview without touching FSRS', () => {
  it('seeds the ability row from the learner OWN settings, not a global default', async () => {
    await resetData();
    await P.saveSettings({ grammarLevels: ['N2'] });
    const itemId = await addOneItem('CAL_seed');

    await studyOnce(itemId, 3);

    const ability = await prisma.learnerAbility.findFirst();
    await resetData();
    await P.saveSettings({ grammarLevels: ['N5'] });
    const otherItem = await addOneItem('CAL_seed_low');
    await studyOnce(otherItem, 3);
    const otherAbility = await prisma.learnerAbility.findFirst();

    expect(ability!.abilityReceptive).toBeGreaterThan(otherAbility!.abilityReceptive);
  });

  it('a graded turn moves ability + item challenge, and counts observations', async () => {
    await resetData();
    const itemId = await addOneItem('CAL_move');

    const before = await prisma.item.findFirst({ where: { id: itemId } });
    expect(before!.challenge).toBeNull(); // never measured yet — no backfill
    expect(before!.challengeObservations).toBe(0);

    await studyOnce(itemId, 4); // an easy win

    const after = await prisma.item.findFirst({ where: { id: itemId } });
    const ability = await prisma.learnerAbility.findFirst();
    expect(after!.challenge).not.toBeNull();
    expect(after!.challengeObservations).toBe(1);
    expect(ability!.receptiveObservations).toBe(1);
    expect(ability!.productiveObservations).toBe(0);
    expect(ability!.abilityProductive).toBe(ability!.abilityRegister);
  });

  it('grades a turn when the ability row carries a legacy id from the multi-user era', async () => {
    await resetData();
    const itemId = await addOneItem('CAL_legacy_id');
    const legacyId = 'clz0legacyabilityrow0001';
    await prisma.learnerAbility.create({
      data: {
        id: legacyId,
        abilityReceptive: 1100,
        abilityProductive: 1100,
        abilityRegister: 1100,
      },
    });

    const result = await studyOnce(itemId, 3);

    expect(result.items).toHaveLength(1);
    expect(await prisma.reviewLog.count({ where: {} })).toBe(1);
    expect(await prisma.srsState.count({ where: { itemId } })).toBe(1);

    expect(await prisma.learnerAbility.count({ where: {} })).toBe(1);
    const ability = await prisma.learnerAbility.findFirst();
    expect(ability!.receptiveObservations).toBe(1);
  });

  it('FSRS values are IDENTICAL with calibration in the path (invariant 1)', async () => {
    await resetData();
    await resetData();
    const itemA = await addOneItem('CAL_fsrs');
    const itemB = await addOneItem('CAL_fsrs');
    const at = new Date('2026-07-26T09:00:00Z');

    for (const rating of [3, 4, 2] as RatingValue[]) {
      await studyOnce(itemA, rating, at);
      await studyOnce(itemB, rating, at);
    }

    const srsA = await prisma.srsState.findFirst({ where: { itemId: itemA } });
    const srsB = await prisma.srsState.findFirst({ where: { itemId: itemB } });
    expect(srsA!.stability).toBe(srsB!.stability);
    expect(srsA!.difficulty).toBe(srsB!.difficulty);
    expect(srsA!.reps).toBe(srsB!.reps);
    expect(srsA!.state).toBe(srsB!.state);
    const itemRow = await prisma.item.findFirst({ where: { id: itemA } });
    expect(itemRow!.challenge).not.toBe(srsA!.difficulty);
  });

  it('shadow mode proposes NOTHING on a thin history (no confident guess from 3 turns)', async () => {
    await resetData();
    const itemId = await addOneItem('CAL_thin');
    const result = await studyOnce(itemId, 1); // a miss, but only one observation
    expect(result.calibration).toBe(null);
  });

  it('shadow mode proposes a change once there IS evidence, and applies nothing', async () => {
    await resetData();
    const itemId = await addOneItem('CAL_evidence');
    const settingsBefore = await P.getSettings();

    let last: Awaited<ReturnType<typeof studyOnce>> | null = null;
    for (let i = 0; i < 16; i += 1) last = await studyOnce(itemId, 1);

    expect(last!.calibration).not.toBe(null);
    expect(last!.calibration!.measured).toBeLessThan(0.75);
    expect(last!.calibration!.observations).toBeGreaterThanOrEqual(12);
    expect(await P.getSettings()).toEqual(settingsBefore);
  });
});

describe('listItems quality filter — the sweep needs a target list', () => {
  const OK = JSON.stringify({
    v: CURRENT_ENRICHMENT_VERSION,
    structure: ['動詞 + X'],
    usage: 'Một câu giải thích đủ dài để vượt ngưỡng tối thiểu của thẻ.',
    collocations: [],
    example: { ja: 'あ', vi: 'a' },
    examples: [{ ja: 'い', vi: 'b' }],
    pitfalls: ['x'],
    contrasts: [{ with: 'y', note: 'z' }],
  });

  it('separates missing / broken / thin / ok, and needs-work spans the first three', async () => {
    await resetData();
    const bare = await addOneItem('Q_missing');
    const broken = await addOneItem('Q_broken');
    const thin = await addOneItem('Q_thin');
    const ok = await addOneItem('Q_ok');
    await P.saveEnrichments([
      { itemId: broken, enrichmentJson: '{"collocations":["x"]}' },
      { itemId: thin, enrichmentJson: '{"usage":"Ngắn.","example":{"ja":"あ","vi":"a"}}' },
      { itemId: ok, enrichmentJson: OK },
    ]);

    const ids = async (quality: string) =>
      (await P.listItems({ quality: quality as never })).map((i) => i.itemId).sort();

    expect(await ids('missing')).toEqual([bare]);
    expect(await ids('broken')).toEqual([broken]);
    expect(await ids('thin')).toEqual([thin]);
    expect(await ids('ok')).toEqual([ok]);
    expect(await ids('needs-work')).toEqual([bare, broken, thin].sort());
    expect((await P.listItems({ enriched: true })).length).toBe(3);
  });

  it('applies the limit AFTER scoring, so it never filters just one page', async () => {
    await resetData();
    for (const name of ['P_a', 'P_b', 'P_c']) {
      const id = await addOneItem(name);
      await P.saveEnrichments([{ itemId: id, enrichmentJson: OK }]);
    }
    await addOneItem('P_gap1');
    await addOneItem('P_gap2');

    const found = await P.listItems({ quality: 'missing', limit: 2 });
    expect(found.map((i) => i.expression).sort()).toEqual(['P_gap1', 'P_gap2']);
  });
});

describe('getLibraryHealth — the whole-kho aggregate', () => {
  it('counts card quality, below-target items and the weak cluster from real rows', async () => {
    const { getLibraryHealth } = await import('@/lib/library/health');
    await resetData();
    await P.saveSettings({ grammarLevels: ['N3'] });

    await P.addItems([{ expression: 'H_studied', meaningVi: 'x', level: 'N3' }]);
    await P.addItems([{ expression: 'H_easy', meaningVi: 'x', level: 'N5' }]);

    const health = (await getLibraryHealth()).health;
    expect(health.totals.grammar).toBe(2);
    expect(health.quality.missing).toBe(2);
    expect(health.byStudiedLevel).toEqual([{ level: 'N3', total: 1, needsWork: 1 }]);
    expect(health.belowTargetActive).toBe(1);
    expect(health.retention.measured).toBeNull();
    expect(health.weakCluster).toBeNull();
  });
});

describe('TEACH_BACK reuses the practice pipeline exactly', () => {
  async function teachBackOnce(
    itemId: string,
    o: { rating?: RatingValue; explanation?: string } = {},
  ) {
    const { sentenceId } = await P.stageSentence({
      direction: 'JA_VI',
      exerciseType: P.TEACH_BACK_EXERCISE,
      sourceText: '〜ばかりに',
      suggested: 'Gắn sau động từ thể từ điển; chỉ vì một chuyện nhỏ mà ra kết quả xấu.',
      items: [{ itemId, role: 'TARGET' }],
    });
    return P.submitReview({
      sentenceId,
      userAnswer:
        o.explanation ??
        'Mẫu này gắn sau động từ thể từ điển, diễn tả chỉ vì một chuyện nhỏ mà dẫn tới hậu quả xấu ' +
          'ngoài ý muốn, thường mang giọng tiếc nuối.',
      ratings: [{ itemId, rating: o.rating ?? 4, role: 'TARGET' }],
    });
  }

  it('writes exactly one ReviewLog and advances the SrsState, like any other turn', async () => {
    await resetData();
    const itemId = await addOneItem('TB_pattern');

    const result = await teachBackOnce(itemId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].itemId).toBe(itemId);
    expect(await prisma.reviewLog.count({ where: { itemId } })).toBe(1);
    const srs = await prisma.srsState.findFirst({ where: { itemId } });
    expect(srs?.state).not.toBe(0); // no longer "new" — it went through the scheduler
    const sentence = await prisma.sentence.findFirst({
      where: { id: result.sentenceId },
    });
    expect(sentence?.exerciseType).toBe('TEACH_BACK');
    expect(sentence?.status).toBe('GRADED');
  });

  it('counts as RECEPTIVE evidence — no Japanese was produced, so productive must not move', async () => {
    await resetData();
    const itemId = await addOneItem('TB_axis');

    await teachBackOnce(itemId);

    const after = await prisma.learnerAbility.findFirst();
    expect(after!.receptiveObservations).toBe(1);
    expect(after!.productiveObservations).toBe(0);
    expect(after!.registerObservations).toBe(0);
    expect(after!.abilityProductive).toBe(after!.abilityRegister);
  });

  it('offers the explanation to a card-less pattern, and stays silent once a card exists', async () => {
    await resetData();
    const itemId = await addOneItem('TB_harvest');

    const harvested = await teachBackOnce(itemId);
    expect(harvested.teachBack).toMatchObject({ itemId, expression: 'TB_harvest', rating: 4 });
    expect(harvested.teachBack!.usage).toContain('tiếc nuối');

    await P.saveEnrichments([
      {
        itemId,
        enrichmentJson: JSON.stringify({
          usage: 'Đã có cách dùng sẵn trên thẻ.',
          example: { ja: '行ったばかりに。', vi: 'Chỉ vì đã đi.' },
        }),
      },
    ]);
    expect((await teachBackOnce(itemId)).teachBack).toBeNull();
  });

  it('never harvests a poor explanation — a wrong card is worse than no card', async () => {
    await resetData();
    const itemId = await addOneItem('TB_poor');
    const result = await teachBackOnce(itemId, {
      rating: 1,
      explanation: 'Hình như nó nghĩa là "chỉ vì", mà tôi không nhớ gắn vào đâu, chắc là danh từ.',
    });
    expect(result.teachBack).toBeNull();
  });

  it('a TRANSLATION turn never produces a harvest, however well it was graded', async () => {
    await resetData();
    const itemId = await addOneItem('TB_not_teachback');
    expect((await studyOnce(itemId, 4)).teachBack).toBeNull();
  });
});

describe('P2025 của Prisma mang theo tên model (hợp đồng cho thông điệp lỗi MCP)', () => {
  it('update một hàng không tồn tại → code P2025 + meta.modelName', async () => {
    await resetData();

    const caught = await prisma.item
      .update({ where: { id: 'khong-ton-tai' }, data: { meaningVi: 'x' } })
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(caught, 'update vào id không tồn tại phải ném').not.toBeNull();
    const e = caught as { code?: string; meta?: { modelName?: string } };
    expect(e.code).toBe('P2025');
    expect(e.meta?.modelName, 'tool-kit.ts đọc đúng trường này để chọn lời khuyên').toBe('Item');
  });
});
