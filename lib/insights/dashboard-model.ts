import { needsWork, scoreEnrichment } from '@/lib/library/enrichment-quality';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import {
  breakdownByLevelAndLength,
  validAnswerSec,
  type BreakdownSentence,
  type PerfBreakdown,
} from '@/lib/session/perf-breakdown';
import { parseErrorTags, type ErrorTag } from '@/lib/session/error-tags';
import { JLPT_LEVELS } from '@/lib/settings/schema';
import {
  REVIEW_STATE,
  WATCHLIST_DIFFICULTY,
  computeTrueRetention,
  type TrueRetention,
} from '@/lib/srs/retention';
import { LEECH_LAPSES, SUSPEND_SUGGEST_LAPSES } from '@/lib/srs/srs';
import { studyDayKey, type Streak } from '@/lib/srs/streak';

// Every number on the Phân tích page, computed from one set of rows (lib/insights/dashboard.ts reads
// them). Before roadmap 5.3 four functions each queried and counted on their own, so the same idea
// (what is "new", which window a count covers) could drift between two tiles of one page.

const DAY_MS = 86_400_000;
/** The daily table behind Thống kê: one study day per entry, oldest first. */
export const STUDY_DAYS = 365;
/** The heatmap and the true-retention window: 52 weeks. */
export const ACTIVITY_DAYS = 364;
const RECENT_DAYS = 30; // "30 ngày qua" on the tiles, and the weak-spot window
const FORECAST_DAYS = 14;
const WATCHLIST_SIZE = 8;
const LEECH_LIST_SIZE = 15;
const WORST_LIST_SIZE = 10;

export type { PerfBreakdown };

export interface LogRow {
  reviewedAt: Date;
  rating: number;
  state: number; // FSRS state BEFORE the review: 0 = the item's first review
  errorTags: string | null;
  itemId: string | null; // null once the item is deleted
  expression: string | null;
}

export interface ItemRow {
  id: string;
  kind: string;
  level: string;
  suspended: boolean;
  expression: string;
  meaningVi: string;
  enrichment: string | null; // only read for grammar
  srs: { state: number; due: Date; reps: number; lapses: number; difficulty: number } | null;
}

export type SentenceRow = BreakdownSentence;

export interface DashboardInput {
  now: Date;
  settings: {
    dayCutoffHour: number;
    desiredRetention: number;
    sessionGoal: number;
    dailyNewGrammar: number;
  };
  /** Review logs of the last STUDY_DAYS days. */
  logs: readonly LogRow[];
  /** Graded sentences answered in the last STUDY_DAYS days. */
  sentences: readonly SentenceRow[];
  items: readonly ItemRow[];
  streak: Streak;
}

export interface DailyStat {
  day: string; // "YYYY-MM-DD" study-day key (cutoff-adjusted)
  reviews: number; // review-log rows that day
  correct: number; // of those, rating >= 3
  newItems: number; // first-ever reviews that day (state 0) = items introduced
  sentences: number; // graded sentences answered that day
  secSum: number; // sum of time-to-answer (s) for timed sentences that day
  secCount: number; // count of timed sentences (for a correct weighted mean)
}

export interface StudyStats {
  rangeDays: number;
  daily: DailyStat[]; // oldest to newest, one entry per day in the window
  overallAccuracy: number | null; // % over the whole window (null if no reviews)
  overallAvgSec: number;
  scoreByLevel: PerfBreakdown[];
  scoreByLength: PerfBreakdown[];
}

export interface LevelDist {
  level: string;
  new: number;
  learning: number;
  review: number;
  relearning: number;
  suspended: number;
  total: number;
}

export type Mastery = {
  new: number;
  learning: number;
  review: number;
  relearning: number;
  suspended: number;
};

export interface WeakReport {
  tagCounts: { tag: ErrorTag; count: number }[];
  worstItems: { itemId: string; expression: string; misses: number; tags: ErrorTag[] }[];
  leeches: {
    itemId: string;
    expression: string;
    meaningVi: string;
    lapses: number;
    suspendSuggested: boolean;
  }[];
  watchlist: { itemId: string; expression: string; difficulty: number }[];
}

export interface Dashboard {
  settings: { sessionGoal: number; dailyNewGrammar: number };
  grammarTotal: number; // suspended included
  vocabTotal: number;
  newItems: number; // grammar never reviewed, not suspended
  dueNow: number;
  masteredGrammar: number; // FSRS state Review, not suspended
  mastery: Mastery;
  levelDist: LevelDist[]; // grammar by JLPT level and FSRS state
  streak: Streak;
  reviewsLast30: number;
  newLast30: number;
  activity: { day: string; count: number }[]; // oldest to newest, ACTIVITY_DAYS entries
  activityMax: number;
  forecast14: { day: string; count: number }[];
  retention: { actual: TrueRetention; desired: number; windowDays: number };
  study: StudyStats;
  weak: WeakReport;
  content: { enrichedGrammar: number; studiedWithoutCard: number };
}

const isNew = (i: ItemRow) => !i.srs || i.srs.state === 0;

function levelDist(grammar: readonly ItemRow[]): LevelDist[] {
  const byLevel = new Map<string, LevelDist>(
    JLPT_LEVELS.map((level) => [
      level,
      { level, new: 0, learning: 0, review: 0, relearning: 0, suspended: 0, total: 0 },
    ]),
  );
  for (const row of grammar) {
    const d = byLevel.get(row.level);
    if (!d) continue; // an out-of-taxonomy level: skip rather than crash
    d.total += 1;
    if (row.suspended) d.suspended += 1;
    else if (isNew(row)) d.new += 1;
    else if (row.srs!.state === 1) d.learning += 1;
    else if (row.srs!.state === 2) d.review += 1;
    else d.relearning += 1;
  }
  return JLPT_LEVELS.map((l) => byLevel.get(l)!).filter((d) => d.total > 0);
}

function studyStats(input: DashboardInput): StudyStats {
  const { now, logs, sentences } = input;
  const cutoff = input.settings.dayCutoffHour;
  const map = new Map<string, DailyStat>();
  for (let i = 0; i < STUDY_DAYS; i += 1) {
    const day = studyDayKey(new Date(now.getTime() - (STUDY_DAYS - 1 - i) * DAY_MS), cutoff);
    map.set(day, {
      day,
      reviews: 0,
      correct: 0,
      newItems: 0,
      sentences: 0,
      secSum: 0,
      secCount: 0,
    });
  }
  for (const l of logs) {
    const d = map.get(studyDayKey(l.reviewedAt, cutoff));
    if (!d) continue;
    d.reviews += 1;
    if (l.rating >= 3) d.correct += 1;
    if (l.state === 0) d.newItems += 1;
  }
  for (const s of sentences) {
    if (!s.answeredAt) continue;
    const d = map.get(studyDayKey(s.answeredAt, cutoff));
    if (!d) continue;
    d.sentences += 1;
    const sec = validAnswerSec(s);
    if (sec !== null) {
      d.secSum += sec;
      d.secCount += 1;
    }
  }
  const daily = [...map.values()];
  const sum = (f: (d: DailyStat) => number) => daily.reduce((a, d) => a + f(d), 0);
  const reviews = sum((d) => d.reviews);
  const secCount = sum((d) => d.secCount);
  return {
    rangeDays: STUDY_DAYS,
    daily,
    overallAccuracy: reviews ? Math.round((sum((d) => d.correct) / reviews) * 100) : null,
    overallAvgSec: secCount ? Math.round(sum((d) => d.secSum) / secCount) : 0,
    ...breakdownByLevelAndLength(sentences),
  };
}

function weakReport(input: DashboardInput, live: readonly ItemRow[]): WeakReport {
  const since = input.now.getTime() - RECENT_DAYS * DAY_MS;
  const tagTally = new Map<ErrorTag, number>();
  const perItem = new Map<string, { expression: string; misses: number; tags: Set<ErrorTag> }>();
  for (const miss of input.logs) {
    if (miss.rating > 2 || miss.itemId == null || miss.reviewedAt.getTime() < since) continue;
    const entry = perItem.get(miss.itemId) ?? {
      expression: miss.expression ?? '(đã xóa)',
      misses: 0,
      tags: new Set<ErrorTag>(),
    };
    entry.misses += 1;
    for (const tag of parseErrorTags(miss.errorTags)) {
      tagTally.set(tag, (tagTally.get(tag) ?? 0) + 1);
      entry.tags.add(tag);
    }
    perItem.set(miss.itemId, entry);
  }

  return {
    tagCounts: [...tagTally.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
    worstItems: [...perItem.entries()]
      .map(([itemId, e]) => ({
        itemId,
        expression: e.expression,
        misses: e.misses,
        tags: [...e.tags],
      }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, WORST_LIST_SIZE),
    // Leeches count every kind; the watchlist is grammar only, as before.
    leeches: live
      .filter((i) => i.srs && i.srs.lapses >= LEECH_LAPSES)
      .sort((a, b) => b.srs!.lapses - a.srs!.lapses)
      .slice(0, LEECH_LIST_SIZE)
      .map((i) => ({
        itemId: i.id,
        expression: i.expression,
        meaningVi: i.meaningVi,
        lapses: i.srs!.lapses,
        suspendSuggested: i.srs!.lapses >= SUSPEND_SUGGEST_LAPSES,
      })),
    watchlist: live
      .filter(
        (i) =>
          i.kind === GRAMMAR_KIND &&
          i.srs &&
          i.srs.reps > 0 &&
          i.srs.difficulty >= WATCHLIST_DIFFICULTY,
      )
      .sort((a, b) => b.srs!.difficulty - a.srs!.difficulty)
      .slice(0, WATCHLIST_SIZE)
      .map((i) => ({ itemId: i.id, expression: i.expression, difficulty: i.srs!.difficulty })),
  };
}

export function buildDashboard(input: DashboardInput): Dashboard {
  const { now, settings } = input;
  const cutoff = settings.dayCutoffHour;
  const grammar = input.items.filter((i) => i.kind === GRAMMAR_KIND);
  const live = input.items.filter((i) => !i.suspended);
  const liveGrammar = grammar.filter((i) => !i.suspended);
  const started = liveGrammar.filter((i) => !isNew(i));

  const stateCount = (state: number) => liveGrammar.filter((i) => i.srs?.state === state).length;
  const mastery: Mastery = {
    new: liveGrammar.filter(isNew).length,
    learning: stateCount(1),
    review: stateCount(2),
    relearning: stateCount(3),
    suspended: grammar.length - liveGrammar.length,
  };

  const activityStart = now.getTime() - ACTIVITY_DAYS * DAY_MS;
  const recentStart = now.getTime() - RECENT_DAYS * DAY_MS;
  const activityLogs = input.logs.filter((l) => l.reviewedAt.getTime() >= activityStart);
  const recent = activityLogs.filter((l) => l.reviewedAt.getTime() >= recentStart);
  const dayTally = new Map<string, number>();
  for (const l of activityLogs) {
    const key = studyDayKey(l.reviewedAt, cutoff);
    dayTally.set(key, (dayTally.get(key) ?? 0) + 1);
  }
  const activity = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const day = studyDayKey(new Date(now.getTime() - (ACTIVITY_DAYS - 1 - i) * DAY_MS), cutoff);
    return { day, count: dayTally.get(day) ?? 0 };
  });

  // Due dates are bucketed by UTC calendar day, as the FSRS scheduler writes them.
  const horizon = now.getTime() + FORECAST_DAYS * DAY_MS;
  const dueTally = new Map<string, number>();
  for (const i of started) {
    const t = i.srs!.due.getTime();
    if (t <= now.getTime() || t > horizon) continue;
    const key = i.srs!.due.toISOString().slice(0, 10);
    dueTally.set(key, (dueTally.get(key) ?? 0) + 1);
  }
  const forecast14 = Array.from({ length: FORECAST_DAYS }, (_, i) => {
    const day = new Date(now.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { day, count: dueTally.get(day) ?? 0 };
  });

  const needsCard = (i: ItemRow) => needsWork(scoreEnrichment(i.enrichment, GRAMMAR_KIND).tier);

  return {
    settings: { sessionGoal: settings.sessionGoal, dailyNewGrammar: settings.dailyNewGrammar },
    grammarTotal: grammar.length,
    vocabTotal: input.items.filter((i) => i.kind === VOCAB_KIND).length,
    newItems: mastery.new,
    dueNow: started.filter((i) => i.srs!.due.getTime() <= now.getTime()).length,
    masteredGrammar: mastery.review,
    mastery,
    levelDist: levelDist(grammar),
    streak: input.streak,
    reviewsLast30: recent.length,
    newLast30: recent.filter((l) => l.state === 0).length,
    activity,
    activityMax: Math.max(1, ...activity.map((a) => a.count)),
    forecast14,
    retention: {
      actual: computeTrueRetention(activityLogs.filter((l) => l.state === REVIEW_STATE)),
      desired: settings.desiredRetention,
      windowDays: ACTIVITY_DAYS,
    },
    study: studyStats(input),
    weak: weakReport(input, live),
    content: {
      enrichedGrammar: grammar.filter((i) => !needsCard(i)).length,
      studiedWithoutCard: grammar.filter((i) => (i.srs?.reps ?? 0) > 0 && needsCard(i)).length,
    },
  };
}
