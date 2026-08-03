// Time-series analytics for the "Thống kê" tab on the dashboard (components/analytics-tabs.tsx —
// it is a tab, not its own route). Fetches ONE 365-day window of
// review logs + graded sentences and rolls them into a per-study-day series; the client then windows
// (30/90/365) + groups (day/week/month/weekday) it for the charts, so changing a selector never hits
// the server. Read-only, like lib/analytics.ts (which powers the dashboard summary).

import { prisma } from '@/lib/db';
import type { PerfBreakdown } from '@/lib/analytics';
import { lengthBucket } from '@/lib/format';
import { getSettings } from '@/lib/practice';
import { JLPT_LEVELS } from '@/lib/settings-schema';
import { studyDayKey } from '@/lib/streak';

const DAY_MS = 86_400_000;
const RANGE_DAYS = 365;
const MAX_ANSWER_SEC = 3600;

export interface DailyStat {
  day: string; // "YYYY-MM-DD" study-day key (cutoff-adjusted)
  reviews: number; // review-log rows that day
  correct: number; // of those, rating ≥ 3
  newItems: number; // first-ever reviews that day (state 0) = items introduced
  sentences: number; // graded sentences answered that day
  secSum: number; // Σ time-to-answer (s) for timed sentences that day
  secCount: number; // count of timed sentences (for a correct weighted mean)
}

export interface StudyStats {
  rangeDays: number; // window fetched (365)
  daily: DailyStat[]; // oldest → newest, one entry per day in the window
  overallAccuracy: number | null; // % over the whole window (null if no reviews)
  overallAvgSec: number; // mean time-to-answer over the window
  scoreByLevel: PerfBreakdown[]; // by target-pattern JLPT level, over the window
  scoreByLength: PerfBreakdown[]; // by source-sentence length bucket, over the window
}

interface Agg {
  label: string;
  order: number;
  scores: number[];
  secs: number[];
  count: number;
}

export async function getStudyStats(userId: string, now: Date = new Date()): Promise<StudyStats> {
  const { dayCutoffHour } = await getSettings(userId);
  const since = new Date(now.getTime() - RANGE_DAYS * DAY_MS);

  const [logs, sentences] = await Promise.all([
    prisma.reviewLog.findMany({
      where: { userId, reviewedAt: { gte: since } },
      select: { reviewedAt: true, rating: true, state: true },
    }),
    prisma.sentence.findMany({
      where: { userId, status: 'GRADED', answeredAt: { gte: since } },
      select: {
        createdAt: true,
        answeredAt: true,
        score: true,
        sourceText: true,
        reviews: { select: { role: true, item: { select: { level: true } } } },
      },
    }),
  ]);

  // Pre-seed every day in the window so gaps render as zero (not missing points).
  const map = new Map<string, DailyStat>();
  for (let i = 0; i < RANGE_DAYS; i += 1) {
    const day = studyDayKey(new Date(now.getTime() - (RANGE_DAYS - 1 - i) * DAY_MS), dayCutoffHour);
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
    const d = map.get(studyDayKey(l.reviewedAt, dayCutoffHour));
    if (!d) continue;
    d.reviews += 1;
    if (l.rating >= 3) d.correct += 1;
    if (l.state === 0) d.newItems += 1;
  }

  const durationSec = (s: { createdAt: Date; answeredAt: Date | null }): number =>
    s.answeredAt ? (s.answeredAt.getTime() - s.createdAt.getTime()) / 1000 : -1;

  for (const s of sentences) {
    if (!s.answeredAt) continue;
    const d = map.get(studyDayKey(s.answeredAt, dayCutoffHour));
    if (!d) continue;
    d.sentences += 1;
    const sec = durationSec(s);
    if (sec >= 0 && sec <= MAX_ANSWER_SEC) {
      d.secSum += sec;
      d.secCount += 1;
    }
  }

  const daily = [...map.values()];
  const totReviews = daily.reduce((a, d) => a + d.reviews, 0);
  const totCorrect = daily.reduce((a, d) => a + d.correct, 0);
  const totSecSum = daily.reduce((a, d) => a + d.secSum, 0);
  const totSecCount = daily.reduce((a, d) => a + d.secCount, 0);

  // --- Score + time by difficulty (target level) and by source length, over the window ---
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
  for (const s of sentences) {
    const sec = durationSec(s);
    const validSec = sec >= 0 && sec <= MAX_ANSWER_SEC ? sec : null;
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

  return {
    rangeDays: RANGE_DAYS,
    daily,
    overallAccuracy: totReviews ? Math.round((totCorrect / totReviews) * 100) : null,
    overallAvgSec: totSecCount ? Math.round(totSecSum / totSecCount) : 0,
    scoreByLevel: [...perfByLevel.values()].sort((a, b) => a.order - b.order).map(summarize),
    scoreByLength: [...perfByLength.values()].sort((a, b) => a.order - b.order).map(summarize),
  };
}
