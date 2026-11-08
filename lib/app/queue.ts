import type { UserDb } from '@/lib/db/user-db';
import {
  CARD_STATE,
  planQueue,
  type QueueCandidate,
  type QueuePlan,
  type StudiedToday,
} from '@/lib/domain/queue';
import { getSettings } from '@/lib/library/practice';
import { GRAMMAR_KIND, ITEM_KINDS, KANJI_KIND, VOCAB_KIND, asItemKind } from '@/lib/library/item-kinds';
import { levelsFrom, pickNewItems } from '@/lib/domain/new-items';
import type { JlptLevel, Settings } from '@/lib/settings/schema';
import { studyDayStart } from '@/lib/srs/select';

// Reads what the queue needs from the database and lets lib/domain/queue decide. Nothing calls this
// yet; quick review (roadmap 2.3) and next_turn (3.1) will.

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
    kind: asItemKind(row.item.kind),
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
  const counts: StudiedToday = { newGrammar: 0, newVocab: 0, reviews: 0 };
  for (const log of logs) {
    if (log.state === CARD_STATE.REVIEW) counts.reviews++;
    if (log.state !== 0 || !log.item || log.item.kind === KANJI_KIND) continue;
    if (log.item.kind === VOCAB_KIND) counts.newVocab++;
    else counts.newGrammar++;
  }
  return counts;
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

export async function getQueue(db: UserDb, now: Date = new Date(), limit?: number): Promise<Queue> {
  const settings = await getSettings(db);
  const today = await studiedToday(db, settings, now);
  const caps = {
    newGrammar: settings.dailyNewGrammar,
    newVocab: settings.dailyNewVocab,
    maxReviews: settings.maxReviewsPerDay,
  };
  // Grammar and vocabulary only: kanji cards have their own queue in Ôn nhanh (KJ3).
  const live = { suspended: false, kind: { in: [...ITEM_KINDS] } };
  const select = { state: true, due: true, item: { select: ITEM_FIELDS } } as const;

  // Learning steps are fetched whole and reviews only up to today's allowance, so a backlog of
  // overdue reviews can never push a card that is mid-step out of the fetch.
  const [learning, reviews, newGrammar, newVocab, ahead] = await Promise.all([
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
    db.srsState.findFirst({
      where: { state: { not: 0 }, due: { gt: now }, item: live },
      orderBy: { due: 'asc' },
      select,
    }),
  ]);

  const rows = [...learning, ...reviews, ...newGrammar, ...newVocab, ...(ahead ? [ahead] : [])];
  const byId = new Map(rows.map((r) => [r.item.id, toCard(r)]));
  const plan = planQueue({ candidates: [...byId.values()], caps, today, now, limit });
  return { ...plan, cards: plan.cards.map((c) => byId.get(c.id)!), today };
}
