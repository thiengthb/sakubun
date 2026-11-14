import type { UserDb } from '@/lib/db/user-db';
import {
  CARD_STATE,
  planQueue,
  type QueueCandidate,
  type QueuePlan,
  type StudiedToday,
} from '@/lib/domain/queue';
import { getSettings } from '@/lib/library/practice';
import { createKanjiItems, ownedKanji, rankedNewKanji } from '@/lib/app/kanji-items';
import { kanjiCatalog } from '@/lib/kanji/load';
import {
  GRAMMAR_KIND,
  ITEM_KINDS,
  KANJI_KIND,
  VOCAB_KIND,
  asItemKind,
  isKanji,
} from '@/lib/library/item-kinds';
import { levelsFrom, pickNewItems } from '@/lib/domain/new-items';
import type { JlptLevel, Settings } from '@/lib/settings/schema';
import { studyDayStart } from '@/lib/srs/select';

// Reads what the queue needs from the database and lets lib/domain/queue decide: for Ôn nhanh
// (lib/app/quick-review.ts), next_turn (lib/app/turn.ts) and `status`.

export interface QueueCard extends QueueCandidate {
  expression: string;
  reading: string | null;
  meaningVi: string;
  level: string;
}

export interface Queue extends Omit<QueuePlan, 'cards'> {
  cards: QueueCard[];
  today: StudiedToday;
}

const ITEM_FIELDS = {
  id: true,
  kind: true,
  expression: true,
  reading: true,
  meaningVi: true,
  level: true,
} as const;

type Row = {
  state: number;
  due: Date;
  item: {
    id: string;
    kind: string;
    expression: string;
    reading: string | null;
    meaningVi: string;
    level: string;
  };
};

function toCard(row: Row): QueueCard {
  return {
    id: row.item.id,
    kind: isKanji(row.item.kind) ? KANJI_KIND : asItemKind(row.item.kind),
    state: row.state,
    due: row.due,
    expression: row.item.expression,
    reading: row.item.reading,
    meaningVi: row.item.meaningVi,
    level: row.item.level,
  };
}

export async function studiedToday(
  db: UserDb,
  settings: Settings,
  now: Date,
): Promise<StudiedToday> {
  const logs = await db.reviewLog.findMany({
    where: { reviewedAt: { gte: studyDayStart(now, settings.dayCutoffHour) } },
    select: { state: true, item: { select: { kind: true } } },
  });
  const counts: StudiedToday = { newGrammar: 0, newVocab: 0, newKanji: 0, reviews: 0 };
  for (const log of logs) {
    if (log.state === CARD_STATE.REVIEW) counts.reviews++;
    if (log.state !== 0 || !log.item) continue;
    if (log.item.kind === KANJI_KIND) counts.newKanji++;
    else if (log.item.kind === VOCAB_KIND) counts.newVocab++;
    else counts.newGrammar++;
  }
  return counts;
}

// Ôn nhanh brings in new kanji itself (KJ3): every Jōyō kanji is waiting, and an Item is made for
// the next ones only when today's allowance has room, so the library holds the kanji met so far.
// Ranked by lib/kanji/introduce: the kanji of the words being learned come first, then the kanji
// from the learner's vocabulary level.
async function introduceKanji(
  db: UserDb,
  settings: Settings,
  today: StudiedToday,
  now: Date,
): Promise<void> {
  const waiting = await db.srsState.count({
    where: { state: CARD_STATE.NEW, item: { kind: KANJI_KIND, suspended: false } },
  });
  const need = settings.dailyNewKanji - today.newKanji - waiting;
  if (need <= 0) return;
  const catalog = await kanjiCatalog();
  const have = await ownedKanji(db);
  const next = (await rankedNewKanji(db, catalog, have, settings.vocabLevel)).slice(0, need);
  // Two Ôn nhanh pages opened at once both bring them in: the other one's are kept.
  await createKanjiItems(db, next, now);
}

// The day's new kanji, in the order they were brought in.
async function newKanji(db: UserDb, take: number): Promise<Row[]> {
  if (take <= 0) return [];
  return db.srsState.findMany({
    where: { state: CARD_STATE.NEW, item: { kind: KANJI_KIND, suspended: false } },
    orderBy: { item: { createdAt: 'asc' } },
    take,
    select: { state: true, due: true, item: { select: ITEM_FIELDS } },
  });
}

// The next new items of one kind (plan 2026-11-07-translation-difficulty, D): every unstarted item
// at or below the level studied is read lightly, lib/domain/new-items picks, and only the picked
// ones are read whole, in the picked order.
async function newItems(db: UserDb, kind: string, level: JlptLevel, take: number): Promise<Row[]> {
  if (take <= 0) return [];
  const live = { suspended: false, kind };
  const [candidates, started] = await Promise.all([
    db.item.findMany({
      where: { ...live, level: { in: levelsFrom(level) }, srs: { state: 0 } },
      select: {
        id: true,
        level: true,
        expression: true,
        source: true,
        libraryEntryId: true,
        createdAt: true,
      },
    }),
    db.srsState.count({ where: { state: { not: 0 }, item: { kind } } }),
  ]);
  const ids = pickNewItems(
    candidates.map((c) => ({
      id: c.id,
      level: c.level,
      listed: c.libraryEntryId !== null || c.source === 'OPENJLPT',
      createdAt: c.createdAt,
      key: `${kind}:${c.expression}`,
    })),
    level,
    started,
    take,
  );
  const rows = await db.srsState.findMany({
    where: { itemId: { in: ids } },
    select: { state: true, due: true, item: { select: ITEM_FIELDS } },
  });
  const at = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => at.get(a.item.id)! - at.get(b.item.id)!);
}

/**
 * The cards to study now. Grammar and vocabulary only, as next_turn and `status` want; Ôn nhanh
 * passes `kanji` to add the kanji cards (KJ3), bringing in today's new ones first. A page that only
 * counts the cards (Hôm nay) passes `introduce: false`: it reads the kanji without creating any.
 */
export async function getQueue(
  db: UserDb,
  now: Date = new Date(),
  limit?: number,
  { kanji = false, introduce = true }: { kanji?: boolean; introduce?: boolean } = {},
): Promise<Queue> {
  const settings = await getSettings(db);
  const today = await studiedToday(db, settings, now);
  if (kanji && introduce) await introduceKanji(db, settings, today, now);
  const caps = {
    newGrammar: settings.dailyNewGrammar,
    newVocab: settings.dailyNewVocab,
    newKanji: kanji ? settings.dailyNewKanji : 0,
    maxReviews: settings.maxReviewsPerDay,
  };
  const kinds: string[] = kanji ? [...ITEM_KINDS, KANJI_KIND] : [...ITEM_KINDS];
  const live = { suspended: false, kind: { in: kinds } };
  const select = { state: true, due: true, item: { select: ITEM_FIELDS } } as const;

  // Learning steps are fetched whole and reviews only up to today's allowance, so a backlog of
  // overdue reviews can never push a card that is mid-step out of the fetch.
  const [learning, reviews, newGrammar, newVocab, kanjiNew, ahead] = await Promise.all([
    db.srsState.findMany({
      where: {
        state: { in: [CARD_STATE.LEARNING, CARD_STATE.RELEARNING] },
        due: { lte: now },
        item: live,
      },
      orderBy: { due: 'asc' },
      select,
    }),
    db.srsState.findMany({
      where: { state: CARD_STATE.REVIEW, due: { lte: now }, item: live },
      orderBy: { due: 'asc' },
      take: Math.max(0, caps.maxReviews - today.reviews),
      select,
    }),
    newItems(db, GRAMMAR_KIND, settings.grammarLevel, caps.newGrammar - today.newGrammar),
    newItems(db, VOCAB_KIND, settings.vocabLevel, caps.newVocab - today.newVocab),
    newKanji(db, caps.newKanji - today.newKanji),
    db.srsState.findFirst({
      where: { state: { not: 0 }, due: { gt: now }, item: live },
      orderBy: { due: 'asc' },
      select,
    }),
  ]);

  const rows = [
    ...learning,
    ...reviews,
    ...newGrammar,
    ...newVocab,
    ...kanjiNew,
    ...(ahead ? [ahead] : []),
  ];
  const byId = new Map(rows.map((r) => [r.item.id, toCard(r)]));
  const plan = planQueue({ candidates: [...byId.values()], caps, today, now, limit });
  return { ...plan, cards: plan.cards.map((c) => byId.get(c.id)!), today };
}

/**
 * How many cards are due now, for the dot on the Ôn nhanh tab (UI v2, B2). It runs on every page,
 * so it is one count: cards already met (learning, review, relearning) whose time has come, of
 * every kind Ôn nhanh shows, suspended items left out. New cards are not counted: they wait on the
 * daily allowance, not on a date.
 */
export async function countDue(db: UserDb, now: Date = new Date()): Promise<number> {
  return db.srsState.count({
    where: {
      state: { not: CARD_STATE.NEW },
      due: { lte: now },
      item: { suspended: false, kind: { in: [...ITEM_KINDS, KANJI_KIND] } },
    },
  });
}
