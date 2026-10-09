import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/practice';
import {
  breakdownByLevelAndLength,
  validAnswerSec,
  type PerfBreakdown,
} from '@/lib/perf-breakdown';
import { studyDayKey } from '@/lib/streak';

const DAY_MS = 86_400_000;
const RANGE_DAYS = 365;

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

export async function getStudyStats(now: Date = new Date()): Promise<StudyStats> {
  const { dayCutoffHour } = await getSettings();
  const since = new Date(now.getTime() - RANGE_DAYS * DAY_MS);

  const [logs, sentences] = await Promise.all([
    prisma.reviewLog.findMany({
      where: { reviewedAt: { gte: since } },
      select: { reviewedAt: true, rating: true, state: true },
    }),
    prisma.sentence.findMany({
      where: { status: 'GRADED', answeredAt: { gte: since } },
      select: {
        createdAt: true,
        answeredAt: true,
        score: true,
        sourceText: true,
        reviews: { select: { role: true, item: { select: { level: true } } } },
      },
    }),
  ]);

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

  for (const s of sentences) {
    if (!s.answeredAt) continue;
    const d = map.get(studyDayKey(s.answeredAt, dayCutoffHour));
    if (!d) continue;
    d.sentences += 1;
    const sec = validAnswerSec(s);
    if (sec !== null) {
      d.secSum += sec;
      d.secCount += 1;
    }
  }

  const daily = [...map.values()];
  const totReviews = daily.reduce((a, d) => a + d.reviews, 0);
  const totCorrect = daily.reduce((a, d) => a + d.correct, 0);
  const totSecSum = daily.reduce((a, d) => a + d.secSum, 0);
  const totSecCount = daily.reduce((a, d) => a + d.secCount, 0);

  const { scoreByLevel, scoreByLength } = breakdownByLevelAndLength(sentences);

  return {
    rangeDays: RANGE_DAYS,
    daily,
    overallAccuracy: totReviews ? Math.round((totCorrect / totReviews) * 100) : null,
    overallAvgSec: totSecCount ? Math.round(totSecSum / totSecCount) : 0,
    scoreByLevel,
    scoreByLength,
  };
}
