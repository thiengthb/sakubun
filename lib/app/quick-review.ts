import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { recordReviews } from '@/lib/app/record-review';
import { getQueue } from '@/lib/app/queue';
import { classOf, quizPool } from '@/lib/app/quiz-pool';
import {
  openJlptExample,
  openJlptExamples,
  type OpenJlptExample,
} from '@/lib/app/openjlpt-examples';
import { answerSurface, buildCloze, type ClozeChoice, type ClozeExample } from '@/lib/domain/cloze';
import { CARD_STATE, type QueueKind } from '@/lib/domain/queue';
import type { KanjiEntry } from '@/lib/kanji/catalog';
import { kanjiCatalog, kanjiStrokes } from '@/lib/kanji/load';
import {
  isRemembered,
  ratingForAnswer,
  RATINGS,
  type QuickAnswer,
} from '@/lib/domain/quick-review';
import { markSpan, markSpans, type Segment } from '@/lib/domain/sentence';
import { exampleFromNotes } from '@/lib/import/openjlpt';
import { kaiwaExamples, kaiwaLines, type KaiwaLine } from '@/lib/kaiwa/examples';
import { asItemKind, isKanji, KANJI_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { parseEnrichment } from '@/lib/library/enrichment';
import { getSettings } from '@/lib/library/practice';
import { searchForms } from '@/lib/session/staging-checks';
import { rateOnce, type RatingValue, type SrsFields } from '@/lib/srs/srs';

// Quick review on the web: the queue's cards dressed for the screen (an example sentence with the
// item underlined, or a cloze once the item has been seen), and the one call that grades an answer.
// Grading is the app's, not an AI's: a flip takes one of the four FSRS ratings, a cloze choice is
// right or wrong.

export interface QuickSentence {
  segments: Segment[];
  // Vietnamese, from the item's card or data/openjlpt/examples.json; null for a bare sentence.
  translation: string | null;
}

interface QuickCardBase {
  itemId: string;
  kind: QueueKind;
  level: string;
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string;
  structure: string | null;
  note: string | null;
  isNew: boolean;
  // When the item comes back for each rating, for the label on each flip button.
  dueBy: Record<RatingValue, Date>;
}

/** The back of a kanji card (KJ3): the readings for reference, and the words that use it. */
export interface KanjiFace {
  /**
   * What the front asks (KJ4): to recognise the glyph, or to write it from its Hán Việt, meaning
   * and a word with the kanji left blank. Writing takes turns with recognising once the kanji has
   * been met, when Cài đặt keeps handwriting on.
   */
  prompt: 'recognize' | 'write';
  /** KanjiVG's strokes in order (SVG path data, 109 × 109), drawn on the back and graded on the pad. */
  paths: string[];
  /** One of the learner's words with this kanji as a blank (□済), to cue the writing; null if none. */
  cue: string | null;
  strokes: number;
  on: string[];
  kun: string[];
  radical: { radical: string; nameVi: string };
  parts: string[];
  /** Words in the learner's library written with it, started ones first. */
  words: { expression: string; reading: string | null; meaningVi: string }[];
}

export type QuickCard =
  | (QuickCardBase & { mode: 'flip'; sentence: QuickSentence | null })
  // A kanji: the glyph alone in front, graded with the four FSRS ratings like a flip.
  | (QuickCardBase & { mode: 'kanji'; face: KanjiFace })
  | (QuickCardBase & {
      mode: 'cloze';
      sentence: QuickSentence;
      // What fills the blank once answered.
      answer: string;
      choices: ClozeChoice[];
    });

/** A grammar or vocab card: what a group's flashcards show (getItemCards). */
export type SentenceCard = Exclude<QuickCard, { mode: 'kanji' }>;

export interface QuickReview {
  cards: QuickCard[];
  nextDueAt: Date | null;
}

// FNV-1a: a stable number per item and review count, so a reload shows the same card and the next
// review of the item a different sentence or order.
function seedFor(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// The item's sentences: its card's (written by the learner's AI), then its OpenJLPT sentence with the
// translation, furigana and place from data/openjlpt/examples.json when that has it, else the bare
// sentence kept in its notes, then lines of the learner's own Kaiwa scripts that use it. A sentence
// examples.json marks unfit to learn from is left out.
function examplesOf(
  item: { kind: string; expression: string; enrichment: string | null; notes: string | null },
  openJlpt: OpenJlptExample | null,
  kaiwa: readonly KaiwaLine[],
): ClozeExample[] {
  const card = parseEnrichment(item.enrichment);
  const fromCard = card ? [card.example, ...card.examples] : [];
  const fromKaiwa = kaiwaExamples(kaiwa, item);
  if (openJlpt?.skip) return [...fromCard, ...fromKaiwa];
  if (openJlpt?.example) return [...fromCard, openJlpt.example, ...fromKaiwa];
  const fromNotes = exampleFromNotes(item.notes);
  return [...fromCard, ...(fromNotes ? [{ ja: fromNotes.ja }] : []), ...fromKaiwa];
}

// One of the examples that contain the item in some form (a verb is often conjugated: 急いだ), taken
// in turn: the first on the first meeting, the next one on each later review.
function underlined(
  item: { kind: string; expression: string; reading: string | null },
  examples: readonly ClozeExample[],
  turn = 0,
): QuickSentence | null {
  const surface = answerSurface(item.expression);
  const forms =
    item.kind === VOCAB_KIND ? searchForms(surface, item.reading) : surface ? [surface] : [];
  const marked = examples.flatMap((example): QuickSentence[] => {
    const translation = example.vi?.trim() || null;
    if (example.spans) {
      const segments = markSpans(example.ja, example.jaRuby?.trim(), example.spans, 'target');
      return [{ segments, translation }];
    }
    const ja = example.ja.trim();
    const form = forms.find((f) => ja.includes(f));
    if (!form) return [];
    const start = ja.indexOf(form);
    const span = { start, end: start + form.length };
    return [{ segments: markSpan(ja, example.jaRuby?.trim(), span, 'target'), translation }];
  });
  return marked.length > 0 ? marked[turn % marked.length] : null;
}

// The learner's Kaiwa lines, read once per request.
async function learnerKaiwa(db: UserDb): Promise<KaiwaLine[]> {
  return kaiwaLines(await db.script.findMany({ select: { body: true, analysis: true } }));
}

type CardItem = {
  id: string;
  kind: string;
  level: string;
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string;
  enrichment: string | null;
};

function baseCard(
  item: CardItem,
  srs: SrsFields,
  retention: number,
  now: Date,
  openJlpt: OpenJlptExample | null,
): QuickCardBase {
  const card = parseEnrichment(item.enrichment);
  const formation = openJlpt && !openJlpt.skip ? openJlpt.formationVi : null;
  return {
    itemId: item.id,
    kind: isKanji(item.kind) ? KANJI_KIND : asItemKind(item.kind),
    level: item.level,
    expression: item.expression,
    reading: item.reading,
    hanviet: item.hanviet,
    meaningVi: item.meaningVi,
    structure: card?.structure.join(' / ') || formation || null,
    note: card?.pitfalls[0] ?? null,
    isNew: srs.state === CARD_STATE.NEW,
    dueBy: Object.fromEntries(
      RATINGS.map((rating) => [rating, rateOnce(srs, rating, { retention, now }).next.due]),
    ) as Record<RatingValue, Date>,
  };
}

// The same card for browsing chosen items (a group), in the given order: always a flip card, and
// nothing is graded, so the FSRS schedule is left alone.
export async function getItemCards(
  db: UserDb,
  ids: string[],
  now: Date = new Date(),
): Promise<SentenceCard[]> {
  const [settings, items, examples, kaiwa] = await Promise.all([
    getSettings(db),
    db.item.findMany({ where: { id: { in: ids } }, include: { srs: true } }),
    openJlptExamples(),
    learnerKaiwa(db),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    if (!item?.srs) return [];
    const openJlpt = openJlptExample(examples, item.kind, item.expression);
    return [
      {
        ...baseCard(item, item.srs, settings.desiredRetention, now, openJlpt),
        mode: 'flip' as const,
        sentence: underlined(item, examplesOf(item, openJlpt, kaiwa)),
      },
    ];
  });
}

const KANJI_WORDS = 4;

// The back of each kanji card: the catalog's readings, radical and parts, and up to four words of
// the learner's that use it, the started ones first.
async function kanjiFaces(
  db: UserDb,
  cards: { expression: string; reps: number }[],
  handwriting: boolean,
): Promise<Map<string, KanjiFace>> {
  if (cards.length === 0) return new Map();
  const chars = cards.map((c) => c.expression);
  const repsOf = new Map(cards.map((c) => [c.expression, c.reps]));
  const [catalog, paths, words] = await Promise.all([
    kanjiCatalog(),
    kanjiStrokes(),
    db.item.findMany({
      where: {
        kind: VOCAB_KIND,
        suspended: false,
        OR: chars.map((c) => ({ expression: { contains: c } })),
      },
      select: {
        expression: true,
        reading: true,
        meaningVi: true,
        srs: { select: { state: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const byKanji = new Map<string, KanjiEntry>(catalog.map((k) => [k.kanji, k]));
  const started = (w: (typeof words)[number]) => (w.srs?.state ?? 0) !== CARD_STATE.NEW;
  return new Map(
    chars.flatMap((char): [string, KanjiFace][] => {
      const k = byKanji.get(char);
      if (!k) return [];
      const using = words
        .filter((w) => w.expression.includes(char))
        .sort((a, b) => Number(started(b)) - Number(started(a)))
        .slice(0, KANJI_WORDS)
        .map(({ expression, reading, meaningVi }) => ({ expression, reading, meaningVi }));
      const strokes = paths[char] ?? [];
      const reps = repsOf.get(char) ?? 0;
      // A kanji is met first by sight; after that writing takes every other turn.
      const write = handwriting && reps > 0 && reps % 2 === 1 && strokes.length > 0;
      const cueWord = using.find((w) => w.expression.length > 1);
      return [
        [
          char,
          {
            prompt: write ? 'write' : 'recognize',
            paths: strokes,
            cue: cueWord ? cueWord.expression.replaceAll(char, '□') : null,
            strokes: k.strokes,
            on: k.on,
            kun: k.kun,
            radical: { radical: k.radical.radical, nameVi: k.radical.nameVi },
            parts: k.parts,
            words: using,
          },
        ],
      ];
    }),
  );
}

export async function getQuickReview(
  db: UserDb,
  now: Date = new Date(),
  limit = 20,
): Promise<QuickReview> {
  const settings = await getSettings(db);
  const queue = await getQueue(db, now, limit, { kanji: true });
  const ids = queue.cards.map((c) => c.id);
  const [items, states, pool, openJlpt, kaiwa] = await Promise.all([
    db.item.findMany({
      where: { id: { in: ids } },
      select: { id: true, hanviet: true, enrichment: true, notes: true },
    }),
    db.srsState.findMany({ where: { itemId: { in: ids } } }),
    quizPool(),
    openJlptExamples(),
    learnerKaiwa(db),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const srsById = new Map(states.map((s) => [s.itemId, s]));
  const faces = await kanjiFaces(
    db,
    queue.cards
      .filter((c) => c.kind === KANJI_KIND)
      .map((c) => ({ expression: c.expression, reps: srsById.get(c.id)?.reps ?? 0 })),
    settings.kanjiHandwriting,
  );

  const cards = queue.cards.flatMap((queued): QuickCard[] => {
    const item = itemById.get(queued.id)!;
    const srs = srsById.get(queued.id)!;
    if (queued.kind === KANJI_KIND) {
      const face = faces.get(queued.expression);
      if (!face) return [];
      const base = baseCard({ ...queued, ...item }, srs, settings.desiredRetention, now, null);
      return [{ ...base, mode: 'kanji', face }];
    }
    const kind = queued.kind;
    const found = openJlptExample(openJlpt, kind, queued.expression);
    const base = baseCard({ ...queued, ...item }, srs, settings.desiredRetention, now, found);
    const examples = examplesOf({ ...queued, ...item }, found, kaiwa);
    // A new item is met first as a flip card; a cloze tests one already seen.
    if (!base.isNew) {
      const cloze = buildCloze({
        target: { ...queued, kind, cls: classOf(pool, kind, queued.expression) },
        examples,
        pool: pool.items[kind],
        seed: seedFor(`${queued.id}:${srs.reps}`),
      });
      if (cloze) {
        return [
          {
            ...base,
            mode: 'cloze',
            sentence: { segments: cloze.sentence, translation: cloze.translation },
            answer: cloze.answer,
            choices: cloze.choices,
          },
        ];
      }
    }
    return [{ ...base, mode: 'flip', sentence: underlined(queued, examples, srs.reps) }];
  });

  return { cards, nextDueAt: queue.nextDueAt };
}

export type CardAnswer = (
  | { itemId: string; mode: 'flip'; rating: RatingValue }
  | { itemId: string; mode: 'cloze'; choiceId: string }
) & {
  /**
   * U2e: the device's id for this grade. The session moves on before the server answers and sends
   * the grade again if the reply is lost, so the same id is recorded at most once.
   */
  clientId?: string;
};

const isPrismaCode = (e: unknown, code: string) =>
  typeof e === 'object' && e !== null && 'code' in e && e.code === code;

export interface AnsweredCard {
  rating: RatingValue;
  correct: boolean;
  nextDue: Date;
}

export async function answerCard(
  db: UserDb,
  answer: CardAnswer,
  now: Date = new Date(),
): Promise<ActionResult<AnsweredCard>> {
  const srs = await db.srsState.findFirst({
    where: { itemId: answer.itemId },
    include: { item: { select: { suspended: true } } },
  });
  if (!srs) return err('Không tìm thấy mục này. Tải lại trang để lấy thẻ mới.');
  // The same grade sent again (its first reply was lost, or the page sent it as it closed): it is
  // in already, so say so again rather than refuse it as a second grade.
  const savedCopy = async (): Promise<ActionResult<AnsweredCard> | null> => {
    if (!answer.clientId) return null;
    const saved = await db.reviewLog.findFirst({
      where: { clientId: answer.clientId },
      select: { rating: true },
    });
    if (!saved) return null;
    const rating = saved.rating as RatingValue;
    const after = await db.srsState.findFirstOrThrow({ where: { itemId: answer.itemId } });
    return ok({ rating, correct: isRemembered(rating), nextDue: after.due });
  };
  const copy = await savedCopy();
  if (copy) return copy;
  if (srs.item.suspended) return err('Mục này đang tạm dừng ôn.');
  // A second tap on the same card arrives after it was rescheduled: refuse instead of rating twice.
  if (srs.state !== CARD_STATE.NEW && srs.due.getTime() > now.getTime()) {
    return err('Thẻ này vừa được chấm rồi. Tải lại trang để lấy thẻ tiếp theo.');
  }

  const quick: QuickAnswer =
    answer.mode === 'flip'
      ? { mode: 'flip', rating: answer.rating }
      : { mode: 'cloze', correct: answer.choiceId === answer.itemId };
  const rating = ratingForAnswer(quick);
  const correct = isRemembered(rating);
  const { desiredRetention } = await getSettings(db);
  try {
    const [recorded] = await recordReviews(
      db,
      [{ itemId: answer.itemId, srs, rating, clientId: answer.clientId }],
      { retention: desiredRetention, now, channel: 'web', onlyIfUnchanged: true },
    );
    return ok({ rating, correct, nextDue: recorded.next.due });
  } catch (e) {
    // Two copies of one grade raced (the page's send and its closing beacon): the other one went
    // in first, either by its id (P2002) or by moving the schedule this one read (P2025).
    if (isPrismaCode(e, 'P2002') || isPrismaCode(e, 'P2025')) {
      const raced = await savedCopy();
      if (raced) return raced;
    }
    // The card was graded elsewhere (another tab) between the read above and this write.
    if (isPrismaCode(e, 'P2025')) {
      return err('Thẻ này vừa được chấm ở nơi khác. Tải lại trang để lấy thẻ tiếp theo.');
    }
    throw e;
  }
}
