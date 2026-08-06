// Progress numbers for the app, computed on the server and shipped as numbers.
//
// This is the other half of decision 4 in ADR 0001. Every value here depends on the study-day cutoff
// (`settings.dayCutoffHour`, applied in `studyDayStart` / `studyDayKey`), and that cutoff is evaluated
// in the SERVER's timezone. A phone in another timezone, or one whose clock has drifted, would compute
// a different "today" from the same rows — so the client is never given the ingredients, only the
// answer. `takenAt` rides along so the UI can say WHEN the answer was true instead of implying "now".
//
// A projection of `getStats()`, not a second computation of it: same call the web dashboard makes.
// Deliberately narrower — `settings` is already in the snapshot, and `weakItems` waits for a screen
// that shows weak items. A wire contract should carry what a screen renders and nothing else.
import { z } from 'zod';
import { getStats } from '@/lib/practice';

export const mobileStatsSchema = z.object({
  takenAt: z.string(),
  /** Work done in the CURRENT study day (server's cutoff, not midnight). */
  today: z.object({ reviews: z.number(), newGrammar: z.number(), sentences: z.number() }),
  /** Daily sentence goal from settings, so the UI can render "câu X/goal" without doing the lookup. */
  sessionGoal: z.number(),
  streak: z.object({ current: z.number(), longest: z.number() }),
  totalItems: z.number(),
  newItems: z.number(),
  dueNow: z.number(),
  reviewsLast7Days: z.number(),
  /** Oldest to newest, `day` as MM-DD — already bucketed by study day, not by calendar midnight. */
  reviewsByDay: z.array(z.object({ day: z.string(), count: z.number() })),
  /** ISO date (YYYY-MM-DD) to how many items come due that day, for the next 7 days. */
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
