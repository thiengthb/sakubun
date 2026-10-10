import { prisma } from '@/lib/db/db';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { getSettings } from '@/lib/library/practice';
import { studyDayKey } from '@/lib/srs/streak';
import { studyDayStart } from '@/lib/srs/select';

export interface ReviewLoadDay {
  date: string; // study day (the day starts at settings.dayCutoffHour, local time)
  grammarDue: number; // reviews coming due that day (overdue ones are counted on day 1)
  vocabDue: number;
  newGrammarPlanned: number; // new patterns the daily limit will introduce that day
}

export interface ReviewLoad {
  days: ReviewLoadDay[];
  reviewedToday: number;
  dailyNewGrammar: number;
  newGrammarRemaining: number;
}

const DAY = 86_400_000;

// Counts only, for scheduling study time (e.g. a calendar assistant). No item content, no learner model.
export async function getReviewLoad(days: number, now: Date = new Date()): Promise<ReviewLoad> {
  const settings = await getSettings();
  const cutoff = settings.dayCutoffHour;
  const start = studyDayStart(now, cutoff);
  const end = new Date(start.getTime() + days * DAY);

  const [due, newGrammarRemaining, reviewedToday] = await Promise.all([
    prisma.srsState.findMany({
      where: { reps: { gt: 0 }, due: { lt: end }, item: { suspended: false } },
      select: { due: true, item: { select: { kind: true } } },
    }),
    prisma.srsState.count({
      where: { state: 0, item: { suspended: false, kind: GRAMMAR_KIND } },
    }),
    prisma.reviewLog.count({ where: { reviewedAt: { gte: start } } }),
  ]);

  const out: ReviewLoadDay[] = Array.from({ length: days }, (_, i) => ({
    date: studyDayKey(new Date(start.getTime() + i * DAY + cutoff * 3_600_000), cutoff),
    grammarDue: 0,
    vocabDue: 0,
    newGrammarPlanned: 0,
  }));
  const index = new Map(out.map((d, i) => [d.date, i]));
  for (const s of due) {
    const i = s.due < start ? 0 : (index.get(studyDayKey(s.due, cutoff)) ?? -1);
    if (i < 0) continue;
    if (s.item.kind === VOCAB_KIND) out[i].vocabDue++;
    else out[i].grammarDue++;
  }
  let left = newGrammarRemaining;
  for (const d of out) {
    d.newGrammarPlanned = Math.min(settings.dailyNewGrammar, left);
    left -= d.newGrammarPlanned;
  }
  return {
    days: out,
    reviewedToday,
    dailyNewGrammar: settings.dailyNewGrammar,
    newGrammarRemaining,
  };
}
