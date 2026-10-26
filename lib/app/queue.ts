import type { UserDb } from '@/lib/db/user-db';
import {
  CARD_STATE,
  planQueue,
  type QueueCandidate,
  type QueuePlan,
  type StudiedToday,
} from '@/lib/domain/queue';
import { getSettings } from '@/lib/library/practice';
import { GRAMMAR_KIND, VOCAB_KIND, asItemKind } from '@/lib/library/item-kinds';
import { hardestLevel, JLPT_LEVELS, type Settings } from '@/lib/settings/schema';
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
    if (log.state !== 0 || !log.item) continue;
    if (log.item.kind === VOCAB_KIND) counts.newVocab++;
    else counts.newGrammar++;
  }
  return counts;
}

// JLPT_LEVELS runs N5 → N1: "at or below" a ceiling is every level up to its index.
function levelsUpTo(ceiling: string): string[] {
  return JLPT_LEVELS.slice(0, JLPT_LEVELS.indexOf(ceiling as (typeof JLPT_LEVELS)[number]) + 1);
}

export async function getQueue(db: UserDb, now: Date = new Date(), limit?: number): Promise<Queue> {
  const settings = await getSettings(db);
  const today = await studiedToday(db, settings, now);
  const caps = {
    newGrammar: settings.dailyNewGrammar,
    newVocab: settings.dailyNewVocab,
    maxReviews: settings.maxReviewsPerDay,
  };
  const live = { suspended: false };
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
    db.srsState.findMany({
      where: {
        state: 0,
        item: { ...live, kind: GRAMMAR_KIND, level: { in: settings.grammarLevels } },
      },
      orderBy: { item: { createdAt: 'asc' } },
      take: Math.max(0, caps.newGrammar - today.newGrammar),
      select,
    }),
    db.srsState.findMany({
      where: {
        state: 0,
        item: {
          ...live,
          kind: VOCAB_KIND,
          // The JLPT levels on the web are the only ceiling; the old hidden vocabCeiling is not read.
          level: { in: levelsUpTo(hardestLevel(settings.grammarLevels)) },
        },
      },
      orderBy: { item: { createdAt: 'asc' } },
      take: Math.max(0, caps.newVocab - today.newVocab),
      select,
    }),
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
