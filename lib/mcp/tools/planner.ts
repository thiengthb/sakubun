import { z } from 'zod';
import { getReviewLoad } from '@/lib/library/review-load';
import { guard, ok, type McpServer } from '@/lib/mcp/tool-kit';

export function registerPlannerTools(server: McpServer) {
  server.tool(
    'get_review_load',
    'READ-ONLY study LOAD per day, for planning study time (e.g. putting review blocks on a calendar). ' +
      'For each of the next `days` study days (a day starts at the learner\'s day-cutoff hour, local ' +
      'time): grammarDue and vocabDue = reviews coming due that day (overdue ones count on the first ' +
      'day), newGrammarPlanned = new patterns the daily limit will introduce. Also reviewedToday. ' +
      'Counts only — no item content. It does not change anything.',
    { days: z.number().int().min(1).max(14).default(7).describe('How many study days, 1–14') },
    guard('get_review_load', async ({ days }: { days: number }) => ok(await getReviewLoad(days))),
  );
}
