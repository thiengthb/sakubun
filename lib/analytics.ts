import { prisma } from '@/lib/db';
import { needsWork, scoreEnrichment } from '@/lib/enrichment-quality';
import { getSettings } from '@/lib/practice';
import {
  MAX_ANSWER_SEC,
  breakdownByLevelAndLength,
  type PerfBreakdown,
} from '@/lib/perf-breakdown';
import { JLPT_LEVELS } from '@/lib/settings-schema';
import { studyDayKey } from '@/lib/streak';
import {
  REVIEW_STATE,
  WATCHLIST_DIFFICULTY,
  computeTrueRetention,
  type TrueRetention,
} from '@/lib/retention';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/item-kinds';

const DAY_MS = 86_400_000;
const HEATMAP_DAYS = 364; // 52 weeks (GitHub-style density)
const ACCURACY_WEEKS = 8;

export interface LevelDist {
  level: string;
  new: number;
  learning: number;
  review: number;
  relearning: number;
  suspended: number;
  total: number;
}

export interface Analytics {
  vocabTotal: number;
  masteredGrammar: number; // FSRS state = Review (2)
  reviewsLast30: number;
  newLast30: number; // first-ever reviews (state 0) in the window = patterns/words introduced
  activity: { day: string; count: number }[]; // oldest → newest, HEATMAP_DAYS entries
  activityMax: number;
  accuracyByWeek: { week: string; total: number; correct: number }[]; // oldest → newest
  levelDist: LevelDist[]; // grammar by JLPT level × FSRS state
  forecast14: { day: string; count: number }[]; // grammar due next 14 days
  avgAnswerSec: number; // mean time-to-answer over the accuracy window (0 if no data)
  answerTimeByWeek: { week: string; avgSec: number }[]; // oldest → newest, avg seconds/answer
  scoreByLevel: PerfBreakdown[];
  scoreByLength: PerfBreakdown[];
  trueRetention: TrueRetention;
  desiredRetention: number; // 0..1, from settings
  retentionWindowDays: number;
  watchlist: DifficultItem[]; // costly-to-hold patterns, worst difficulty first
  enrichedGrammar: number;
  grammarTotal: number;
  studiedWithoutCard: number;
}

export interface DifficultItem {
  itemId: string;
  expression: string;
  meaningVi: string;
  difficulty: number; // FSRS 1..10
  lapses: number;
  reps: number;
}

export type { PerfBreakdown };

export async function getAnalytics(now: Date = new Date()): Promise<Analytics> {
  const settings = await getSettings();
  const cutoff = settings.dayCutoffHour;
  const since = new Date(now.getTime() - HEATMAP_DAYS * DAY_MS);
  const in14 = new Date(now.getTime() + 14 * DAY_MS);
  const answerWindowStart = new Date(now.getTime() - ACCURACY_WEEKS * 7 * DAY_MS);

  const [
    logs,
    levelRows,
    vocabTotal,
    masteredGrammar,
    dueSoon,
    answered,
    allCards,
    studiedCards,
    hardRows,
  ] = await Promise.all([
    prisma.reviewLog.findMany({
      where: { reviewedAt: { gte: since } },
      select: { reviewedAt: true, rating: true, state: true },
    }),
    prisma.item.findMany({
      where: { kind: GRAMMAR_KIND },
      select: { level: true, suspended: true, srs: { select: { state: true } } },
    }),
    prisma.item.count({ where: { kind: VOCAB_KIND } }),
    prisma.srsState.count({
      where: { state: 2, item: { suspended: false, kind: GRAMMAR_KIND } },
    }),
    prisma.srsState.findMany({
      where: {
        due: { gt: now, lte: in14 },
        state: { not: 0 },
        item: { suspended: false, kind: GRAMMAR_KIND },
      },
      select: { due: true },
    }),
    prisma.sentence.findMany({
      where: { status: 'GRADED', answeredAt: { gte: answerWindowStart } },
      select: {
        createdAt: true,
        answeredAt: true,
        score: true,
        sourceText: true,
        reviews: { select: { role: true, item: { select: { level: true } } } },
      },
    }),
    prisma.item.findMany({
      where: { kind: GRAMMAR_KIND },
      select: { enrichment: true },
    }),
    prisma.item.findMany({
      where: { kind: GRAMMAR_KIND, srs: { is: { reps: { gt: 0 } } } },
      select: { enrichment: true },
    }),
    prisma.srsState.findMany({
      where: {
        difficulty: { gte: WATCHLIST_DIFFICULTY },
        reps: { gt: 0 },
        item: { suspended: false, kind: GRAMMAR_KIND },
      },
      orderBy: { difficulty: 'desc' },
      take: 8,
      select: {
        itemId: true,
        difficulty: true,
        lapses: true,
        reps: true,
        item: { select: { expression: true, meaningVi: true } },
      },
    }),
  ]);

  const dayTally = new Map<string, number>();
  let reviewsLast30 = 0;
  let newLast30 = 0;
  const day30 = new Date(now.getTime() - 30 * DAY_MS);
  for (const l of logs) {
    dayTally.set(
      studyDayKey(l.reviewedAt, cutoff),
      (dayTally.get(studyDayKey(l.reviewedAt, cutoff)) ?? 0) + 1,
    );
    if (l.reviewedAt >= day30) {
      reviewsLast30 += 1;
      if (l.state === 0) newLast30 += 1;
    }
  }
  const activity = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const key = studyDayKey(new Date(now.getTime() - (HEATMAP_DAYS - 1 - i) * DAY_MS), cutoff);
    return { day: key, count: dayTally.get(key) ?? 0 };
  });
  const activityMax = Math.max(1, ...activity.map((a) => a.count));

  const accuracyByWeek = Array.from({ length: ACCURACY_WEEKS }, (_, i) => {
    const start = new Date(now.getTime() - (ACCURACY_WEEKS - i) * 7 * DAY_MS);
    const end = new Date(now.getTime() - (ACCURACY_WEEKS - 1 - i) * 7 * DAY_MS);
    let total = 0;
    let correct = 0;
    for (const l of logs) {
      if (l.reviewedAt >= start && l.reviewedAt < end) {
        total += 1;
        if (l.rating >= 3) correct += 1;
      }
    }
    return { week: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`, total, correct };
  });

  const byLevel = new Map<string, LevelDist>();
  for (const l of JLPT_LEVELS) {
    byLevel.set(l, {
      level: l,
      new: 0,
      learning: 0,
      review: 0,
      relearning: 0,
      suspended: 0,
      total: 0,
    });
  }
  for (const row of levelRows) {
    const d = byLevel.get(row.level);
    if (!d) continue; // an out-of-taxonomy level (shouldn't happen) — skip rather than crash
    d.total += 1;
    if (row.suspended) d.suspended += 1;
    else if (!row.srs || row.srs.state === 0) d.new += 1;
    else if (row.srs.state === 1) d.learning += 1;
    else if (row.srs.state === 2) d.review += 1;
    else d.relearning += 1;
  }
  const levelDist = JLPT_LEVELS.map((l) => byLevel.get(l)!).filter((d) => d.total > 0);

  const fTally = new Map<string, number>();
  for (const s of dueSoon) {
    const key = s.due.toISOString().slice(0, 10);
    fTally.set(key, (fTally.get(key) ?? 0) + 1);
  }
  const forecast14 = Array.from({ length: 14 }, (_, i) => {
    const key = new Date(now.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { day: key, count: fTally.get(key) ?? 0 };
  });

  const durationSec = (s: { createdAt: Date; answeredAt: Date | null }): number =>
    s.answeredAt ? (s.answeredAt.getTime() - s.createdAt.getTime()) / 1000 : -1;
  const allDurations = answered.map(durationSec).filter((sec) => sec >= 0 && sec <= MAX_ANSWER_SEC);
  const avgAnswerSec = allDurations.length
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 0;
  const answerTimeByWeek = Array.from({ length: ACCURACY_WEEKS }, (_, i) => {
    const start = new Date(now.getTime() - (ACCURACY_WEEKS - i) * 7 * DAY_MS);
    const end = new Date(now.getTime() - (ACCURACY_WEEKS - 1 - i) * 7 * DAY_MS);
    const secs: number[] = [];
    for (const s of answered) {
      if (s.answeredAt && s.answeredAt >= start && s.answeredAt < end) {
        const sec = durationSec(s);
        if (sec >= 0 && sec <= MAX_ANSWER_SEC) secs.push(sec);
      }
    }
    const avgSec = secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) : 0;
    return { week: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`, avgSec };
  });

  const { scoreByLevel, scoreByLength } = breakdownByLevelAndLength(answered);

  return {
    vocabTotal,
    masteredGrammar,
    reviewsLast30,
    newLast30,
    activity,
    activityMax,
    accuracyByWeek,
    levelDist,
    forecast14,
    avgAnswerSec,
    answerTimeByWeek,
    scoreByLevel,
    scoreByLength,
    trueRetention: computeTrueRetention(logs.filter((l) => l.state === REVIEW_STATE)),
    desiredRetention: settings.desiredRetention,
    retentionWindowDays: HEATMAP_DAYS,
    enrichedGrammar: allCards.filter((c) => !needsWork(scoreEnrichment(c.enrichment, GRAMMAR_KIND).tier))
      .length,
    grammarTotal: allCards.length,
    studiedWithoutCard: studiedCards.filter((c) =>
      needsWork(scoreEnrichment(c.enrichment, GRAMMAR_KIND).tier),
    ).length,
    watchlist: hardRows.map((s) => ({
      itemId: s.itemId,
      expression: s.item.expression,
      meaningVi: s.item.meaningVi,
      difficulty: s.difficulty,
      lapses: s.lapses,
      reps: s.reps,
    })),
  };
}
