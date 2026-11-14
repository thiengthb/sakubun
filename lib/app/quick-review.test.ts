import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';
import type { QuickCard, QuickSentence } from '@/lib/app/quick-review';

createTestDb('sakubun-app-quick-');

type Practice = typeof import('@/lib/library/practice');
type Quick = typeof import('@/lib/app/quick-review');
type Db = typeof import('@/lib/db/db');
let P: Practice;
let Q: Quick;
let prisma: Db['prisma'];
let db: UserDb;

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
    db,
    rows.map((r) => ({ meaningVi: 'nghĩa', level: 'N5', ...r })),
    'MCP',
    kind,
  );
  const found = await db.item.findMany({ select: { id: true, expression: true } });
  return Object.fromEntries(found.map((r) => [r.expression, r.id]));
}

async function makeSeen(itemId: string): Promise<void> {
  await db.srsState.update({
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
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
  // These are about grammar and vocab cards; the kanji cards Ôn nhanh brings in (KJ3) are tested
  // on their own below.
  await P.saveSettings(db, { dailyNewKanji: 0 });
});

const sentenceOf = (card: QuickCard | undefined): QuickSentence | null | undefined =>
  card && card.mode !== 'kanji' ? card.sentence : undefined;

describe('getQuickReview', () => {
  it('meets a new item on a flip card, its example sentence underlining it', async () => {
    const ids = await seed([{ expression: '約束' }]);
    await db.item.update({ where: { id: ids['約束'] }, data: { enrichment: ENRICHMENT } });

    const [card] = (await Q.getQuickReview(db, NOW)).cards;
    expect(card).toMatchObject({
      mode: 'flip',
      isNew: true,
      structure: 'N + を約束する',
      note: 'Không dùng cho lịch hẹn khám bệnh.',
    });
    expect(sentenceOf(card)?.translation).toBe('Tôi đã hẹn với bạn.');
    expect(sentenceOf(card)?.segments).toContainEqual({
      text: '約束',
      reading: 'やくそく',
      mark: 'target',
    });
    // Each button names when the item comes back; a better rating never brings it back sooner.
    const due = [1, 2, 3, 4].map((r) => card.dueBy[r as 1 | 2 | 3 | 4].getTime());
    expect(due[0]).toBeGreaterThan(NOW.getTime());
    expect(due).toEqual([...due].sort((a, b) => a - b));
  });

  it('tests a seen item with a cloze: four choices, the answer not in the sentence', async () => {
    // A learner with a single item still gets a cloze: distractors come from the OpenJLPT list.
    const ids = await seed([{ expression: '約束', level: 'N4' }]);
    await db.item.update({ where: { id: ids['約束'] }, data: { enrichment: ENRICHMENT } });
    await makeSeen(ids['約束']);

    const card = (await Q.getQuickReview(db, NOW)).cards.find((c) => c.itemId === ids['約束'])!;
    expect(card.mode).toBe('cloze');
    if (card.mode !== 'cloze') return;
    expect(card.answer).toBe('約束');
    expect(card.choices).toHaveLength(4);
    expect(card.choices.filter((c) => c.itemId === ids['約束'])).toHaveLength(1);
    expect(card.sentence.segments).toContainEqual({ text: '', mark: 'blank' });
    expect(JSON.stringify(card.sentence.segments)).not.toMatch(/約束|やくそく/);

    // 約束 is a noun in OpenJLPT, so every distractor is a noun of the same level: none can be ruled
    // out by grammar alone.
    const { classOf, quizPool } = await import('@/lib/app/quiz-pool');
    const pool = await quizPool();
    for (const choice of card.choices) {
      expect(classOf(pool, 'VOCAB', choice.expression)).toBe('noun');
    }
  });

  it('offers another order on the next review of the same item', async () => {
    const ids = await seed([{ expression: '約束', level: 'N4' }]);
    await db.item.update({ where: { id: ids['約束'] }, data: { enrichment: ENRICHMENT } });
    await makeSeen(ids['約束']);
    const orders = new Set<string>();
    for (let reps = 3; reps < 13; reps++) {
      await db.srsState.update({ where: { itemId: ids['約束'] }, data: { reps } });
      const [card] = (await Q.getQuickReview(db, NOW)).cards;
      if (card.mode === 'cloze') orders.add(card.choices.map((c) => c.itemId).join());
    }
    expect(orders.size).toBeGreaterThan(5);
  });

  it('falls back to a flip card when no sentence can be blanked', async () => {
    const ids = await seed([
      {
        // Not in OpenJLPT, so the sentence kept in its notes is all it has.
        expression: '書き直す',
        notes: 'EN: rewrite · Ví dụ: 名前を間違えたので、書類を書き直した。 (I rewrote the form.)',
      },
      { expression: '準備' },
      { expression: '練習' },
      { expression: '連絡' },
    ]);
    await makeSeen(ids['書き直す']);

    const card = (await Q.getQuickReview(db, NOW)).cards.find((c) => c.itemId === ids['書き直す'])!;
    expect(card.mode).toBe('flip');
    // The conjugated form is still found and underlined; a bare sentence has no translation.
    expect(sentenceOf(card)?.segments).toContainEqual({ text: '書き直', mark: 'target' });
    expect(sentenceOf(card)?.translation).toBeNull();
  });

  it('takes the translation, furigana, place and formation of an OpenJLPT sentence', async () => {
    // data/openjlpt/examples.json: 〜は "私は学生です。" with Vietnamese, the は placed, the formation.
    const ids = await seed([{ expression: '〜は' }], 'GRAMMAR');
    const [card] = (await Q.getQuickReview(db, NOW)).cards;
    expect(card).toMatchObject({ mode: 'flip', isNew: true, structure: 'Danh từ + は' });
    expect(sentenceOf(card)).toEqual({
      translation: 'Tôi là sinh viên.',
      segments: [
        { text: '私', reading: 'わたし' },
        { text: 'は', mark: 'target' },
        { text: '学生', reading: 'がくせい' },
        { text: 'です。' },
      ],
    });

    // Placed exactly, a one-character pattern can be blanked once it has been seen.
    await makeSeen(ids['〜は']);
    const [seen] = (await Q.getQuickReview(db, NOW)).cards;
    expect(seen.mode).toBe('cloze');
    if (seen.mode !== 'cloze') return;
    expect(seen.answer).toBe('は');
    expect(seen.sentence.translation).toBe('Tôi là sinh viên.');
    expect(seen.sentence.segments).toEqual([
      { text: '私', reading: 'わたし' },
      { text: '', mark: 'blank' },
      { text: '学生', reading: 'がくせい' },
      { text: 'です。' },
    ]);
  });

  it('underlines a conjugated word where the data places it, and leaves a skipped sentence out', async () => {
    const ids = await seed([
      { expression: '会う' },
      // Its OpenJLPT sentence uses another sense; examples.json marks it unfit to learn from.
      { expression: '拝む', notes: 'Ví dụ: その不届きな野郎の顔を、拝ませてもらうか。' },
    ]);
    await makeSeen(ids['会う']);
    const cards = await Q.getQuickReview(db, NOW);
    const au = cards.cards.find((c) => c.itemId === ids['会う'])!;
    // 会わ is not 会う as the choices would show it, so the card stays a flip card.
    expect(au.mode).toBe('flip');
    expect(sentenceOf(au)?.translation).toBe('Anh đã gặp anh Smith rồi nhỉ.');
    expect(sentenceOf(au)?.segments).toContainEqual({ text: '会', reading: 'あ', mark: 'target' });
    expect(sentenceOf(au)?.segments).toContainEqual({ text: 'わ', mark: 'target' });
    expect(sentenceOf(cards.cards.find((c) => c.itemId === ids['拝む']))).toBeNull();
  });

  it("meets a word in a line of the learner's own Kaiwa script, then takes its sentences in turn", async () => {
    const { analyzeLines } = await import('@/lib/kaiwa/furigana');
    const { parseScript } = await import('@/lib/kaiwa/parse');
    const body = 'A: 名前を書き直した。 | Tôi đã viết lại tên.';
    const tokens = [
      { surface: '名前', reading: 'なまえ' },
      { surface: 'を' },
      { surface: '書き直し', reading: 'かきなおし', base: '書き直す' },
      { surface: 'た' },
      { surface: '。' },
    ];
    await db.script.create({
      data: {
        userId: db.$ownerId(),
        title: 'Viết lại',
        body,
        analysis: JSON.stringify(analyzeLines(parseScript(body), () => tokens)),
      },
    });
    // Not in OpenJLPT: its notes sentence and the Kaiwa line are all it has.
    const ids = await seed([
      { expression: '書き直す', notes: 'Ví dụ: 書類を書き直してください。 (Please rewrite it.)' },
    ]);
    const target = (card: QuickCard) =>
      sentenceOf(card)
        ?.segments.filter((s) => s.mark === 'target')
        .map((s) => s.text)
        .join('');

    await makeSeen(ids['書き直す']);
    const sentences = [];
    for (const reps of [3, 4]) {
      await db.srsState.update({ where: { itemId: ids['書き直す'] }, data: { reps } });
      const [card] = (await Q.getQuickReview(db, NOW)).cards;
      expect(card.mode).toBe('flip');
      sentences.push([target(card), sentenceOf(card)?.translation]);
    }
    expect(sentences).toContainEqual(['書き直し', 'Tôi đã viết lại tên.']);
    expect(sentences).toContainEqual(['書き直', null]);
  });

  it('shows the same cards when reloaded the same day', async () => {
    const ids = await seed([
      { expression: '約束' },
      { expression: '準備' },
      { expression: '練習' },
      { expression: '連絡' },
      { expression: '相談' },
    ]);
    await db.item.update({ where: { id: ids['約束'] }, data: { enrichment: ENRICHMENT } });
    await makeSeen(ids['約束']);
    expect(await Q.getQuickReview(db, NOW)).toEqual(await Q.getQuickReview(db, NOW));
  });
});

describe('answerCard', () => {
  it('records a flip with the rating pressed, once; a second tap is refused', async () => {
    const ids = await seed([{ expression: '約束' }]);
    const itemId = ids['約束'];

    const first = await Q.answerCard(db, { itemId, mode: 'flip', rating: 3 }, NOW);
    expect(first).toMatchObject({ ok: true, data: { rating: 3, correct: true } });
    const again = await Q.answerCard(db, { itemId, mode: 'flip', rating: 3 }, NOW);
    expect(again.ok).toBe(false);

    expect(await db.reviewLog.count({ where: { itemId } })).toBe(1);
    expect((await db.srsState.findUniqueOrThrow({ where: { itemId } })).reps).toBe(1);
  });

  it('records Hard as it was pressed, not counted as remembered', async () => {
    const ids = await seed([{ expression: '約束' }]);
    const itemId = ids['約束'];
    const hard = await Q.answerCard(db, { itemId, mode: 'flip', rating: 2 }, NOW);
    expect(hard).toMatchObject({ ok: true, data: { rating: 2, correct: false } });
    expect(await db.reviewLog.findFirstOrThrow({ where: { itemId } })).toMatchObject({
      rating: 2,
    });
  });

  it('grades a cloze by the chosen item: a wrong choice is Again', async () => {
    const ids = await seed([{ expression: '約束' }, { expression: '準備' }]);
    await makeSeen(ids['約束']);

    const wrong = await Q.answerCard(
      db,
      { itemId: ids['約束'], mode: 'cloze', choiceId: ids['準備'] },
      NOW,
    );
    expect(wrong).toMatchObject({ ok: true, data: { rating: 1, correct: false } });
    const log = await db.reviewLog.findFirstOrThrow({ where: { itemId: ids['約束'] } });
    expect(log).toMatchObject({ rating: 1, state: 2, channel: 'web', turnId: null });
  });

  it('takes the same grade sent again (its reply was lost) once, and answers ok both times', async () => {
    const ids = await seed([{ expression: '約束' }]);
    const itemId = ids['約束'];
    const grade = { itemId, mode: 'flip', rating: 1, clientId: 'grade-aaaa-0001' } as const;

    const first = await Q.answerCard(db, grade, NOW);
    const again = await Q.answerCard(db, grade, new Date(NOW.getTime() + 5_000));
    expect(first).toMatchObject({ ok: true, data: { rating: 1, correct: false } });
    expect(again).toMatchObject({ ok: true, data: { rating: 1, correct: false } });
    if (first.ok && again.ok) expect(again.data.nextDue).toEqual(first.data.nextDue);
    expect(await db.reviewLog.count({ where: { itemId } })).toBe(1);
    expect((await db.srsState.findUniqueOrThrow({ where: { itemId } })).reps).toBe(1);
  });

  it('two copies of one grade at once (the page and its closing beacon): both ok, one row', async () => {
    const ids = await seed([{ expression: '約束' }]);
    const itemId = ids['約束'];
    const grade = { itemId, mode: 'flip', rating: 3, clientId: 'grade-aaaa-0009' } as const;
    const [a, b] = await Promise.all([Q.answerCard(db, grade, NOW), Q.answerCard(db, grade, NOW)]);
    expect(a.ok && b.ok).toBe(true);
    expect(await db.reviewLog.count({ where: { itemId } })).toBe(1);
  });

  it('refuses a new grade of a card already graded, even with its own device id', async () => {
    const ids = await seed([{ expression: '約束' }]);
    const itemId = ids['約束'];
    await Q.answerCard(db, { itemId, mode: 'flip', rating: 3, clientId: 'grade-aaaa-0002' }, NOW);
    const other = await Q.answerCard(
      db,
      { itemId, mode: 'flip', rating: 3, clientId: 'grade-aaaa-0003' },
      NOW,
    );
    expect(other.ok).toBe(false);
    expect(await db.reviewLog.count({ where: { itemId } })).toBe(1);
  });

  it('refuses a suspended item and writes nothing', async () => {
    const ids = await seed([{ expression: '約束' }]);
    await P.setItemSuspended(db, ids['約束'], true);
    const result = await Q.answerCard(db, { itemId: ids['約束'], mode: 'flip', rating: 3 }, NOW);
    expect(result.ok).toBe(false);
    expect(await db.reviewLog.count()).toBe(0);
  });
});

describe('getItemCards', () => {
  it('shows chosen items as flip cards in the given order, seen or not, and grades nothing', async () => {
    const ids = await seed([{ expression: '約束' }, { expression: '準備' }]);
    await db.item.update({ where: { id: ids['約束'] }, data: { enrichment: ENRICHMENT } });
    await makeSeen(ids['約束']);

    const cards = await Q.getItemCards(db, [ids['準備'], 'missing', ids['約束']], NOW);
    expect(cards.map((c) => [c.itemId, c.mode, c.isNew])).toEqual([
      [ids['準備'], 'flip', true],
      [ids['約束'], 'flip', false],
    ]);
    expect(cards[1].sentence?.segments).toContainEqual({
      text: '約束',
      reading: 'やくそく',
      mark: 'target',
    });
    expect(await db.reviewLog.count()).toBe(0);
  });
});

describe('kanji cards (KJ3)', () => {
  it('brings in new kanji as kanji cards, with the learner’s words that use them', async () => {
    await P.saveSettings(db, { dailyNewKanji: 1, dailyNewVocab: 0 });
    const ids = await seed([{ expression: '経済' }, { expression: '経験' }]);
    await makeSeen(ids['経済']);

    const review = await Q.getQuickReview(db, NOW);
    const card = review.cards.find((c) => c.mode === 'kanji');
    if (card?.mode !== 'kanji') throw new Error('no kanji card');
    expect(card).toMatchObject({
      kind: 'KANJI',
      expression: '経',
      hanviet: 'KINH',
      level: 'N4',
      isNew: true,
    });
    expect(card.face).toMatchObject({ strokes: 11, radical: { radical: '糸' } });
    expect(card.face.on).toContain('ケイ');
    // The started word first.
    expect(card.face.words.map((w) => w.expression)).toEqual(['経済', '経験']);

    const graded = await Q.answerCard(db, { itemId: card.itemId, mode: 'flip', rating: 3 }, NOW);
    expect(graded.ok).toBe(true);
    const log = await db.reviewLog.findFirstOrThrow({ where: { itemId: card.itemId } });
    expect(log).toMatchObject({ rating: 3, state: 0 });
  });

  it('asks every other review of a met kanji to be written, when handwriting is on (KJ4)', async () => {
    await P.saveSettings(db, { dailyNewKanji: 1, dailyNewVocab: 0 });
    const ids = await seed([{ expression: '経済' }]);
    await makeSeen(ids['経済']);
    const met = (await Q.getQuickReview(db, NOW)).cards.find((c) => c.mode === 'kanji');
    if (met?.mode !== 'kanji') throw new Error('no kanji card');
    expect(met.face.prompt).toBe('recognize');

    const kanjiCard = async (reps: number) => {
      await makeSeen(met.itemId);
      await db.srsState.update({ where: { itemId: met.itemId }, data: { reps } });
      const card = (await Q.getQuickReview(db, NOW)).cards.find((c) => c.itemId === met.itemId);
      if (card?.mode !== 'kanji') throw new Error('no kanji card');
      return card.face;
    };
    const written = await kanjiCard(1);
    expect(written).toMatchObject({ prompt: 'write', cue: '□済' });
    expect(written.paths).toHaveLength(11);
    expect((await kanjiCard(2)).prompt).toBe('recognize');

    await P.saveSettings(db, { kanjiHandwriting: false });
    expect((await kanjiCard(3)).prompt).toBe('recognize');
  });
});
