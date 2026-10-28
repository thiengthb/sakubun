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
import { CARD_STATE } from '@/lib/domain/queue';
import {
  isRemembered,
  ratingForAnswer,
  RATINGS,
  type QuickAnswer,
} from '@/lib/domain/quick-review';
import { markSpan, markSpans, type Segment } from '@/lib/domain/sentence';
import { exampleFromNotes } from '@/lib/import/openjlpt';
import { kaiwaExamples, kaiwaLines, type KaiwaLine } from '@/lib/kaiwa/examples';
import { asItemKind, VOCAB_KIND, type ItemKind } from '@/lib/library/item-kinds';
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
  kind: ItemKind;
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

export type QuickCard =
  | (QuickCardBase & { mode: 'flip'; sentence: QuickSentence | null })
  | (QuickCardBase & {
      mode: 'cloze';
      sentence: QuickSentence;
      // What fills the blank once answered.
      answer: string;
      choices: ClozeChoice[];
    });

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
    kind: asItemKind(item.kind),
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
): Promise<QuickCard[]> {
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

export async function getQuickReview(
  db: UserDb,
  now: Date = new Date(),
  limit = 20,
): Promise<QuickReview> {
  const settings = await getSettings(db);
  const queue = await getQueue(db, now, limit);
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

  const cards = queue.cards.map((queued): QuickCard => {
    const item = itemById.get(queued.id)!;
    const srs = srsById.get(queued.id)!;
    const found = openJlptExample(openJlpt, queued.kind, queued.expression);
    const base = baseCard({ ...queued, ...item }, srs, settings.desiredRetention, now, found);
    const examples = examplesOf({ ...queued, ...item }, found, kaiwa);
    // A new item is met first as a flip card; a cloze tests one already seen.
    if (!base.isNew) {
      const cloze = buildCloze({
        target: { ...queued, cls: classOf(pool, queued.kind, queued.expression) },
        examples,
        pool: pool.items[queued.kind],
        seed: seedFor(`${queued.id}:${srs.reps}`),
      });
      if (cloze) {
        return {
          ...base,
          mode: 'cloze',
          sentence: { segments: cloze.sentence, translation: cloze.translation },
          answer: cloze.answer,
          choices: cloze.choices,
        };
      }
    }
    return { ...base, mode: 'flip', sentence: underlined(queued, examples, srs.reps) };
  });

  return { cards, nextDueAt: queue.nextDueAt };
}

export type CardAnswer =
  | { itemId: string; mode: 'flip'; rating: RatingValue }
  | { itemId: string; mode: 'cloze'; choiceId: string };

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
  const [recorded] = await recordReviews(db, [{ itemId: answer.itemId, srs, rating }], {
    retention: desiredRetention,
    now,
    channel: 'web',
  });
  return ok({ rating, correct, nextDue: recorded.next.due });
}
