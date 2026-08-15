import { z } from 'zod';
import { getStats } from '@/lib/library/practice';

export const mobileStatsSchema = z.object({
  takenAt: z.string(),
  today: z.object({ reviews: z.number(), newGrammar: z.number(), sentences: z.number() }),
  sessionGoal: z.number(),
  streak: z.object({ current: z.number(), longest: z.number() }),
  totalItems: z.number(),
  newItems: z.number(),
  dueNow: z.number(),
  reviewsLast7Days: z.number(),
  reviewsByDay: z.array(z.object({ day: z.string(), count: z.number() })),
  dueForecast7Days: z.record(z.string(), z.number()),
  mastery: z.object({
    new: z.number(),
    learning: z.number(),
    review: z.number(),
    relearning: z.number(),
    suspended: z.number(),
  }),
});

export type MobileStats = z.infer<typeof mobileStatsSchema>;

export async function buildMobileStats(now: Date = new Date()): Promise<MobileStats> {
  const stats = await getStats(now);
  return {
    takenAt: now.toISOString(),
    today: stats.today,
    sessionGoal: stats.settings.sessionGoal,
    streak: { current: stats.streak.current, longest: stats.streak.longest },
    totalItems: stats.totalItems,
    newItems: stats.newItems,
    dueNow: stats.dueNow,
    reviewsLast7Days: stats.reviewsLast7Days,
    reviewsByDay: stats.reviewsByDay,
    dueForecast7Days: stats.dueForecast7Days,
    mastery: stats.mastery,
  };
}
