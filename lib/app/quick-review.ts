import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { recordReviews } from '@/lib/app/record-review';
import { getQueue } from '@/lib/app/queue';
import { answerSurface, buildCloze, type ClozeChoice, type ClozeExample } from '@/lib/domain/cloze';
import { CARD_STATE } from '@/lib/domain/queue';
import {
  isRemembered,
  ratingForAnswer,
  RATINGS,
  type QuickAnswer,
} from '@/lib/domain/quick-review';
import { markSpan, type Segment } from '@/lib/domain/sentence';
import { exampleFromNotes } from '@/lib/import/openjlpt';
import { asItemKind, VOCAB_KIND, type ItemKind } from '@/lib/library/item-kinds';
import { parseEnrichment } from '@/lib/library/enrichment';
import { getSettings } from '@/lib/library/practice';
import { searchForms } from '@/lib/session/staging-checks';
import { JLPT_LEVELS } from '@/lib/settings/schema';
import { studyDayStart } from '@/lib/srs/select';
import { rateOnce, type RatingValue, type SrsFields } from '@/lib/srs/srs';

// Quick review on the web: the queue's cards dressed for the screen (an example sentence with the
// item underlined, or a cloze once the item has been seen), and the one call that grades an answer.
// Grading is the app's, not an AI's: a flip takes one of the four FSRS ratings, a cloze choice is
// right or wrong.

export interface QuickSentence {
  segments: Segment[];
  // Vietnamese when the item's card has one; OpenJLPT examples only come with English.
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
  | (QuickCardBase & { mode: 'cloze'; sentence: QuickSentence; choices: ClozeChoice[] });

export interface QuickReview {
  cards: QuickCard[];
  nextDueAt: Date | null;
}

// Distractors come from this many items per kind, ordered by id (a stable, well-mixed sample).
const POOL_SIZE = 300;

// FNV-1a: a stable number per item and study day, so a reload shows the same card.
function seedFor(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function examplesOf(item: { enrichment: string | null; notes: string | null }): ClozeExample[] {
  const card = parseEnrichment(item.enrichment);
  const fromCard = card ? [card.example, ...card.examples] : [];
  const fromNotes = exampleFromNotes(item.notes);
  return fromNotes ? [...fromCard, { ja: fromNotes.ja }] : fromCard;
}

// The first example that contains the item in some form (a verb is often conjugated: 急いだ).
function underlined(
  item: { kind: string; expression: string; reading: string | null },
  examples: readonly ClozeExample[],
): QuickSentence | null {
  const surface = answerSurface(item.expression);
  const forms =
    item.kind === VOCAB_KIND ? searchForms(surface, item.reading) : surface ? [surface] : [];
  for (const example of examples) {
    const ja = example.ja.trim();
    const form = forms.find((f) => ja.includes(f));
    if (!form) continue;
    const start = ja.indexOf(form);
    return {
      segments: markSpan(ja, example.jaRuby?.trim(), { start, end: start + form.length }, 'target'),
      translation: example.vi?.trim() || null,
    };
  }
  return null;
}

function neighbours(levels: readonly string[]): string[] {
  const at = new Set<number>();
  for (const level of levels) {
    const i = JLPT_LEVELS.indexOf(level as (typeof JLPT_LEVELS)[number]);
    if (i >= 0) for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < JLPT_LEVELS.length) at.add(j);
  }
  return [...at].map((i) => JLPT_LEVELS[i]);
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

function baseCard(item: CardItem, srs: SrsFields, retention: number, now: Date): QuickCardBase {
  const card = parseEnrichment(item.enrichment);
  return {
    itemId: item.id,
    kind: asItemKind(item.kind),
    level: item.level,
    expression: item.expression,
    reading: item.reading,
    hanviet: item.hanviet,
    meaningVi: item.meaningVi,
    structure: card?.structure.join(' / ') || null,
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
  const [settings, items] = await Promise.all([
    getSettings(db),
    db.item.findMany({ where: { id: { in: ids } }, include: { srs: true } }),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    if (!item?.srs) return [];
    return [
      {
        ...baseCard(item, item.srs, settings.desiredRetention, now),
        mode: 'flip' as const,
        sentence: underlined(item, examplesOf(item)),
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
  const [items, states] = await Promise.all([
    db.item.findMany({
      where: { id: { in: ids } },
      select: { id: true, hanviet: true, enrichment: true, notes: true },
    }),
    db.srsState.findMany({ where: { itemId: { in: ids } } }),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const srsById = new Map(states.map((s) => [s.itemId, s]));

  const kinds = [...new Set(queue.cards.map((c) => c.kind))];
  const pools = new Map(
    await Promise.all(
      kinds.map(async (kind) => {
        const levels = neighbours(queue.cards.filter((c) => c.kind === kind).map((c) => c.level));
        const rows = await db.item.findMany({
          where: { kind, suspended: false, level: { in: levels } },
          select: { id: true, kind: true, expression: true, reading: true, level: true },
          orderBy: { id: 'asc' },
          take: POOL_SIZE,
        });
        return [kind, rows.map((r) => ({ ...r, kind: asItemKind(r.kind) }))] as const;
      }),
    ),
  );

  const day = studyDayStart(now, settings.dayCutoffHour).toISOString();
  const cards = queue.cards.map((queued): QuickCard => {
    const item = itemById.get(queued.id)!;
    const base = baseCard(
      { ...queued, ...item },
      srsById.get(queued.id)!,
      settings.desiredRetention,
      now,
    );
    const examples = examplesOf(item);
    // A new item is met first as a flip card; a cloze tests one already seen.
    if (!base.isNew) {
      const cloze = buildCloze({
        target: queued,
        examples,
        pool: pools.get(queued.kind) ?? [],
        seed: seedFor(`${queued.id}:${day}`),
      });
      if (cloze) {
        return {
          ...base,
          mode: 'cloze',
          sentence: { segments: cloze.sentence, translation: cloze.translation },
          choices: cloze.choices,
        };
      }
    }
    return { ...base, mode: 'flip', sentence: underlined(queued, examples) };
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
