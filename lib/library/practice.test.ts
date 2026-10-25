import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';
import type { ReviewInput } from '@/lib/app/record-review';
import { CURRENT_ENRICHMENT_VERSION } from '@/lib/library/enrichment';
import type { RatingValue } from '@/lib/srs/srs';

createTestDb('sakubun-practice-');

type Practice = typeof import('@/lib/library/practice');
type RecordModule = typeof import('@/lib/app/record-review');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let R: RecordModule;
let prisma: Db['prisma'];

async function resetData(): Promise<void> {
  await resetLearningData(prisma);
  P.invalidateStreak();
}

async function setCards(cards: { itemId: string; enrichmentJson: string }[]): Promise<void> {
  for (const { itemId, enrichmentJson } of cards) {
    await prisma.item.update({ where: { id: itemId }, data: { enrichment: enrichmentJson } });
  }
}

async function addOneItem(expression: string, kind = 'GRAMMAR'): Promise<string> {
  await P.addItems([{ expression, meaningVi: 'nghĩa' }], 'MCP', kind);
  const row = (await P.listItems({ kind })).find((i) => i.expression === expression);
  if (!row) throw new Error(`seed failed: ${expression}`);
  return row.itemId;
}

async function studyOnce(
  itemId: string,
  rating: RatingValue = 3,
  now = new Date(),
  mistakes: Pick<ReviewInput, 'errorTags' | 'errorDetail'> = {},
) {
  const srs = await prisma.srsState.findUniqueOrThrow({ where: { itemId } });
  return R.recordReviews([{ itemId, srs, rating, ...mistakes }], { retention: 0.9, now });
}

beforeAll(async () => {
  P = await import('@/lib/library/practice');
  R = await import('@/lib/app/record-review');
  ({ prisma } = await import('@/lib/db/db'));
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

describe('errorDetail — the confusion pair behind the tag (additive, no backfill)', () => {
  it('persists the pair, and a review WITHOUT one still writes exactly as before', async () => {
    await resetData();
    const itemId = await addOneItem('DETAIL_dokoroka');
    await studyOnce(itemId, 2, new Date(), {
      errorTags: ['word-choice'],
      errorDetail: [{ tag: 'word-choice', used: 'ほかに', required: '〜どころか' }],
    });
    await studyOnce(itemId, 3);

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

  it('getWeakReport is unaffected — the flat tag still drives it', async () => {
    await resetData();
    const itemId = await addOneItem('DETAIL_weak');
    await studyOnce(itemId, 1, new Date(), {
      errorTags: ['particle'],
      errorDetail: [{ used: 'に', required: 'で' }],
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

describe('item length limits (lib/library/item-limits.ts)', () => {
  it('skips an entry over a limit with the fix, and stores Hán Việt in upper case', async () => {
    await resetData();
    const res = await P.addItems(
      [
        { expression: '〜にもかかわらず、それでもなお〜しようとする', meaningVi: 'mặc dù' },
        { expression: '〜ものの', meaningVi: 'x'.repeat(61) },
        { expression: '配慮', meaningVi: 'sự quan tâm', reading: 'はいりょ', hanviet: 'phối lự' },
      ],
      'MCP',
      'VOCAB',
    );
    expect(res.created).toBe(1);
    expect(res.skipped.map((s) => s.reason)).toEqual([
      expect.stringMatching(/^Từ \/ mẫu tối đa 20 ký tự/),
      expect.stringMatching(/^Nghĩa tối đa 60 ký tự/),
    ]);
    const row = await prisma.item.findFirstOrThrow({ where: { expression: '配慮' } });
    expect(row.hanviet).toBe('PHỐI LỰ');
  });

  it('edits an old long item without forcing it short, and refuses a new long value', async () => {
    await resetData();
    const old = await prisma.item.create({
      data: { kind: 'GRAMMAR', expression: '〜ばかりに', meaningVi: 'y'.repeat(90), source: 'MCP' },
    });
    await P.updateItem(old.id, {
      expression: '〜ばかりに',
      meaningVi: 'y'.repeat(90),
      level: 'N2',
    });
    expect((await prisma.item.findUniqueOrThrow({ where: { id: old.id } })).level).toBe('N2');
    await expect(P.updateItem(old.id, { meaningVi: 'z'.repeat(61) })).rejects.toThrow(
      /^Nghĩa tối đa 60 ký tự, đang có 61/,
    );
    await expect(P.updateItem(old.id, { hanviet: 'phối lự' })).resolves.toBeTruthy();
    expect((await prisma.item.findUniqueOrThrow({ where: { id: old.id } })).hanviet).toBe(
      'PHỐI LỰ',
    );
  });
});

describe('saveSettings direction', () => {
  it('get_settings reports the direction the web set, and an MCP patch of `direction` moves both', async () => {
    await resetData();
    expect((await P.saveSettings({ directionMode: 'VI_JA' })).direction).toBe('VI_JA');
    expect((await P.getSettings()).direction).toBe('VI_JA');
    const viaMcp = await P.saveSettings({ direction: 'ALTERNATING' });
    expect(viaMcp).toMatchObject({ direction: 'ALTERNATING', directionMode: 'auto' });
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
    await setCards([
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
      await setCards([{ itemId: id, enrichmentJson: OK }]);
    }
    await addOneItem('P_gap1');
    await addOneItem('P_gap2');

    const found = await P.listItems({ quality: 'missing', limit: 2 });
    expect(found.map((i) => i.expression).sort()).toEqual(['P_gap1', 'P_gap2']);
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
