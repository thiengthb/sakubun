import type { UserDb } from '@/lib/db/user-db';
import { getSettings } from '@/lib/library/practice';
import { type Streak, computeStreak, studyDayKey } from '@/lib/srs/streak';

// The streak needs every review ever logged, so it is cached for a minute per study day: the
// dashboard and the streak beacon both ask for it on every page load. One entry per learner.
const STREAK_TTL_MS = 60_000;
const streakCache = new Map<string, { value: Streak; dayKey: string; at: number }>();

// A learner's cached streak is dropped the moment they review (recordReviews), so a new study day
// shows at once; with no learner given, every entry goes (tests).
export function invalidateStreak(ownerId?: string): void {
  if (ownerId === undefined) streakCache.clear();
  else streakCache.delete(ownerId);
}

export async function studyStreak(db: UserDb, cutoffHour: number, now: Date): Promise<Streak> {
  const dayKey = studyDayKey(now, cutoffHour);
  const hit = streakCache.get(db.$ownerId());
  if (hit && hit.dayKey === dayKey && now.getTime() - hit.at < STREAK_TTL_MS) return hit.value;
  const reviewDates = await db.reviewLog.findMany({ select: { reviewedAt: true } });
  const value = computeStreak(
    reviewDates.map((r) => studyDayKey(r.reviewedAt, cutoffHour)),
    dayKey,
  );
  streakCache.set(db.$ownerId(), { value, dayKey, at: now.getTime() });
  return value;
}

export async function getStreak(db: UserDb): Promise<Streak> {
  const settings = await getSettings(db);
  return studyStreak(db, settings.dayCutoffHour, new Date());
}
