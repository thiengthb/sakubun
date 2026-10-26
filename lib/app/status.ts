import type { UserDb } from '@/lib/db/user-db';
import { getQueue } from '@/lib/app/queue';
import type { StudiedToday } from '@/lib/domain/queue';
import { getSettings } from '@/lib/library/practice';
import { computeStreak, studyDayKey } from '@/lib/srs/streak';

// One line of where the learner stands, for the v2 `status` tool: what is due, what is left today,
// and the streak. Read-only.

const STREAK_WINDOW_DAYS = 400;
const DAY_MS = 86_400_000;

export interface StudyStatus {
  // Cards the queue would serve now (learning steps, due reviews within the cap, new within the caps).
  ready: number;
  left: { newGrammar: number; newVocab: number; reviews: number };
  today: StudiedToday;
  streakDays: number;
  nextDueAt: Date | null;
}

export async function getStatus(db: UserDb, now: Date = new Date()): Promise<StudyStatus> {
  const [{ dayCutoffHour }, queue, logs] = await Promise.all([
    getSettings(db),
    getQueue(db, now),
    db.reviewLog.findMany({
      where: { reviewedAt: { gte: new Date(now.getTime() - STREAK_WINDOW_DAYS * DAY_MS) } },
      select: { reviewedAt: true },
    }),
  ]);
  const days = logs.map((l) => studyDayKey(l.reviewedAt, dayCutoffHour));
  return {
    ready: queue.cards.length,
    left: queue.left,
    today: queue.today,
    streakDays: computeStreak(days, studyDayKey(now, dayCutoffHour)).current,
    nextDueAt: queue.nextDueAt,
  };
}
