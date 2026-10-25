import { prisma } from '@/lib/db/db';
import { getSettings } from '@/lib/library/practice';
import { type Streak, computeStreak, studyDayKey } from '@/lib/srs/streak';

// The streak needs every review ever logged, so it is cached for a minute per study day: the
// dashboard and the streak beacon both ask for it on every page load.
const STREAK_TTL_MS = 60_000;
let streakCache: { value: Streak; dayKey: string; at: number } | null = null;

export function invalidateStreak(): void {
  streakCache = null;
}

export async function studyStreak(cutoffHour: number, now: Date): Promise<Streak> {
  const dayKey = studyDayKey(now, cutoffHour);
  const hit = streakCache;
  if (hit && hit.dayKey === dayKey && now.getTime() - hit.at < STREAK_TTL_MS) return hit.value;
  const reviewDates = await prisma.reviewLog.findMany({ select: { reviewedAt: true } });
  const value = computeStreak(
    reviewDates.map((r) => studyDayKey(r.reviewedAt, cutoffHour)),
    dayKey,
  );
  streakCache = { value, dayKey, at: now.getTime() };
  return value;
}

export async function getStreak(): Promise<Streak> {
  const settings = await getSettings();
  return studyStreak(settings.dayCutoffHour, new Date());
}
