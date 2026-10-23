import { prisma } from '@/lib/db/db';
import {
  planQueue,
  type QueueCandidate,
  type QueuePlan,
  type StudiedToday,
} from '@/lib/domain/queue';
import { getSettings } from '@/lib/library/practice';
import { GRAMMAR_KIND, VOCAB_KIND, asItemKind } from '@/lib/library/item-kinds';
import { JLPT_LEVELS, resolveVocabCeiling, type Settings } from '@/lib/settings/schema';
import { studyDayStart } from '@/lib/srs/select';

// Reads what the queue needs from the database and lets lib/domain/queue decide. Nothing calls this
// yet; quick review (roadmap 2.3) and next_turn (3.1) will.

// Daily cap on new vocabulary until roadmap 1.3 turns it into a setting.
export const DEFAULT_DAILY_NEW_VOCAB = 15;

// Started items fetched per call; far more than one sitting answers.
const STARTED_FETCH = 300;

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

export async function studiedToday(settings: Settings, now: Date): Promise<StudiedToday> {
  const logs = await prisma.reviewLog.findMany({
    where: { reviewedAt: { gte: studyDayStart(now, settings.dayCutoffHour) } },
    select: { state: true, item: { select: { kind: true } } },
  });
  const counts: StudiedToday = { newGrammar: 0, newVocab: 0, reviews: 0 };
  for (const log of logs) {
    if (log.state === 2) counts.reviews++;
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

export async function getQueue(now: Date = new Date(), limit?: number): Promise<Queue> {
  const settings = await getSettings();
  const today = await studiedToday(settings, now);
  const caps = {
    newGrammar: settings.dailyNewGrammar,
    newVocab: DEFAULT_DAILY_NEW_VOCAB,
    maxReviews: settings.maxReviewsPerDay,
  };
  const live = { suspended: false };
  const select = { state: true, due: true, item: { select: ITEM_FIELDS } } as const;

  const [started, newGrammar, newVocab, ahead] = await Promise.all([
    prisma.srsState.findMany({
      where: { state: { not: 0 }, due: { lte: now }, item: live },
      orderBy: { due: 'asc' },
      take: STARTED_FETCH,
      select,
    }),
    prisma.srsState.findMany({
      where: {
        state: 0,
        item: { ...live, kind: GRAMMAR_KIND, level: { in: settings.grammarLevels } },
      },
      orderBy: { item: { createdAt: 'asc' } },
      take: Math.max(0, caps.newGrammar - today.newGrammar),
      select,
    }),
    prisma.srsState.findMany({
      where: {
        state: 0,
        item: {
          ...live,
          kind: VOCAB_KIND,
          level: { in: levelsUpTo(resolveVocabCeiling(settings)) },
        },
      },
      orderBy: { item: { createdAt: 'asc' } },
      take: Math.max(0, caps.newVocab - today.newVocab),
      select,
    }),
    prisma.srsState.findFirst({
      where: { state: { not: 0 }, due: { gt: now }, item: live },
      orderBy: { due: 'asc' },
      select,
    }),
  ]);

  const rows = [...started, ...newGrammar, ...newVocab, ...(ahead ? [ahead] : [])];
  const byId = new Map(rows.map((r) => [r.item.id, toCard(r)]));
  const plan = planQueue({ candidates: [...byId.values()], caps, today, now, limit });
  return { ...plan, cards: plan.cards.map((c) => byId.get(c.id)!), today };
}
