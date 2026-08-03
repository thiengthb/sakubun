// Read-only analytics aggregations for the dashboard (`/`). Kept separate from lib/practice.ts (which
// owns the practice-loop writes) — this is pure reporting. Reuses getStats/getWeakReport in the page;
// this module adds the heavier time-series + distribution rollups those don't cover.

import { prisma } from '@/lib/db';
import { needsWork, scoreEnrichment } from '@/lib/enrichment-quality';
import { lengthBucket } from '@/lib/format';
import { getSettings } from '@/lib/practice';
import { JLPT_LEVELS } from '@/lib/settings-schema';
import { studyDayKey } from '@/lib/streak';
import {
  REVIEW_STATE,
  WATCHLIST_DIFFICULTY,
  computeTrueRetention,
  type TrueRetention,
} from '@/lib/retention';

const GRAMMAR_KIND = 'GRAMMAR';
const VOCAB_KIND = 'VOCAB';
const DAY_MS = 86_400_000;
const HEATMAP_DAYS = 364; // 52 weeks (GitHub-style density)
const ACCURACY_WEEKS = 8;
// Answers longer than this are treated as abandoned (tab left open) and excluded from timing so a
// forgotten sentence can't skew the mean. (Stale pendings are auto-skipped after 1h anyway.)
const MAX_ANSWER_SEC = 3600;

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
  // How score + time-to-answer break down by sentence DIFFICULTY (target pattern's JLPT level) and
  // by sentence LENGTH bucket — "hard/long sentences → lower score, more time?". Only non-empty
  // groups are returned; avgScore is null when no sentence in the group carried a /100 score.
  scoreByLevel: PerfBreakdown[];
  scoreByLength: PerfBreakdown[];
  // Measured retention over the same window, against the target FSRS schedules to. The app has
  // always had the target and never checked the outcome — see lib/retention.ts.
  trueRetention: TrueRetention;
  desiredRetention: number; // 0..1, from settings
  retentionWindowDays: number;
  watchlist: DifficultItem[]; // costly-to-hold patterns, worst difficulty first
  // Enrichment-card coverage, measured by QUALITY (lib/enrichment-quality.ts), not by presence — the
  // same definition `get_library_health` uses, so the two surfaces cannot disagree about the same
  // library. `enrichedGrammar` = cards that actually MEET the bar; `studiedWithoutCard` = patterns the
  // learner is ACTUALLY studying whose card does not, which degrades the new-item mini-lesson, the quiz
  // distractors (the protocol reaches for enrichment.contrasts first) and the detail page at once.
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

export interface PerfBreakdown {
  label: string; // "N3" / "Vừa"
  count: number; // sentences in this group (graded, in window)
  avgScore: number | null; // mean /100 (null if none scored)
  avgSec: number; // mean time-to-answer, seconds (0 if none timed)
}

export async function getAnalytics(userId: string, now: Date = new Date()): Promise<Analytics> {
  const settings = await getSettings(userId);
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
      where: { userId, reviewedAt: { gte: since } },
      select: { reviewedAt: true, rating: true, state: true },
    }),
    prisma.item.findMany({
      where: { userId, kind: GRAMMAR_KIND },
      select: { level: true, suspended: true, srs: { select: { state: true } } },
    }),
    prisma.item.count({ where: { userId, kind: VOCAB_KIND } }),
    prisma.srsState.count({
      where: { userId, state: 2, item: { suspended: false, kind: GRAMMAR_KIND } },
    }),
    prisma.srsState.findMany({
      where: {
        userId,
        due: { gt: now, lte: in14 },
        state: { not: 0 },
        item: { suspended: false, kind: GRAMMAR_KIND },
      },
      select: { due: true },
    }),
    // Graded answers in the accuracy window — for time-to-answer (answeredAt − createdAt) AND the
    // difficulty/length performance breakdowns (score + timing by target-pattern level + source length).
    prisma.sentence.findMany({
      where: { userId, status: 'GRADED', answeredAt: { gte: answerWindowStart } },
      select: {
        createdAt: true,
        answeredAt: true,
        score: true,
        sourceText: true,
        reviews: { select: { role: true, item: { select: { level: true } } } },
      },
    }),
    // Card coverage is scored, not counted (2026-07-27). `enrichment: { not: null }` called a
    // one-line card done forever — the same blindness the MCP surface already fixed — so the dashboard
    // and `get_library_health` would report different numbers for the same library. Two fetches of one
    // column, scored in JS; the tier cannot be expressed in SQL.
    prisma.item.findMany({
      where: { userId, kind: GRAMMAR_KIND },
      select: { enrichment: true },
    }),
    prisma.item.findMany({
      where: { userId, kind: GRAMMAR_KIND, srs: { is: { reps: { gt: 0 } } } },
      select: { enrichment: true },
    }),
    // Expensive-to-hold patterns: high FSRS difficulty, regardless of whether they have lapsed.
    // Complements the leech list in getWeakReport (which keys on `lapses`) — an item can cost a
    // lot to retain without ever having been forgotten outright, and lapses alone never shows it.
    prisma.srsState.findMany({
      where: {
        userId,
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

  // --- Activity heatmap (reviews per study-day, last HEATMAP_DAYS = 364 days) ---
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

  // --- Accuracy by week (rating ≥ 3 = correct), last 8 weeks ---
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

  // --- Grammar distribution by JLPT level × FSRS state ---
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

  // --- Grammar due forecast, next 14 days ---
  const fTally = new Map<string, number>();
  for (const s of dueSoon) {
    const key = s.due.toISOString().slice(0, 10);
    fTally.set(key, (fTally.get(key) ?? 0) + 1);
  }
  const forecast14 = Array.from({ length: 14 }, (_, i) => {
    const key = new Date(now.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { day: key, count: fTally.get(key) ?? 0 };
  });

  // --- Time-to-answer (answeredAt − createdAt, seconds), graded sentences, last 8 weeks ---
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

  // --- Performance by difficulty (target pattern's level) and by source length ---
  interface Agg {
    label: string;
    order: number;
    scores: number[];
    secs: number[];
    count: number;
  }
  const summarize = (a: Agg): PerfBreakdown => ({
    label: a.label,
    count: a.count,
    avgScore: a.scores.length
      ? Math.round(a.scores.reduce((x, y) => x + y, 0) / a.scores.length)
      : null,
    avgSec: a.secs.length ? Math.round(a.secs.reduce((x, y) => x + y, 0) / a.secs.length) : 0,
  });
  const perfByLevel = new Map<string, Agg>();
  const perfByLength = new Map<string, Agg>();
  for (const s of answered) {
    const sec = durationSec(s);
    const validSec = sec >= 0 && sec <= MAX_ANSWER_SEC ? sec : null;
    // Difficulty = TARGET pattern's level (fall back to any rated pattern's level).
    const target =
      s.reviews.find((r) => r.role === 'TARGET' && r.item) ?? s.reviews.find((r) => r.item);
    const level = target?.item?.level ?? null;
    if (level) {
      const g = perfByLevel.get(level) ?? {
        label: level,
        order: JLPT_LEVELS.indexOf(level as (typeof JLPT_LEVELS)[number]),
        scores: [],
        secs: [],
        count: 0,
      };
      g.count += 1;
      if (typeof s.score === 'number') g.scores.push(s.score);
      if (validSec !== null) g.secs.push(validSec);
      perfByLevel.set(level, g);
    }
    const bucket = lengthBucket(s.sourceText.length);
    const gl = perfByLength.get(bucket.key) ?? {
      label: bucket.label,
      order: bucket.order,
      scores: [],
      secs: [],
      count: 0,
    };
    gl.count += 1;
    if (typeof s.score === 'number') gl.scores.push(s.score);
    if (validSec !== null) gl.secs.push(validSec);
    perfByLength.set(bucket.key, gl);
  }
  const scoreByLevel = [...perfByLevel.values()].sort((a, b) => a.order - b.order).map(summarize);
  const scoreByLength = [...perfByLength.values()].sort((a, b) => a.order - b.order).map(summarize);

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
    // Only reviews of cards already in the Review state count — learning/relearning steps are not
    // memory tests, and folding them in inflates the number (lib/retention.ts).
    trueRetention: computeTrueRetention(logs.filter((l) => l.state === REVIEW_STATE)),
    desiredRetention: settings.desiredRetention,
    retentionWindowDays: HEATMAP_DAYS,
    enrichedGrammar: allCards.filter((c) => !needsWork(scoreEnrichment(c.enrichment).tier)).length,
    grammarTotal: allCards.length,
    studiedWithoutCard: studiedCards.filter((c) => needsWork(scoreEnrichment(c.enrichment).tier))
      .length,
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
