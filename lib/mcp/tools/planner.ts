import { z } from 'zod';
import { getReviewLoad } from '@/lib/library/review-load';
import { guard, ok, type McpServer } from '@/lib/mcp/tool-kit';

export function registerPlannerTools(server: McpServer) {
  server.tool(
    'ping',
    'Check that the MCP connection is alive. Returns { ok, time }.',
    {},
    guard('ping', async () => ok({ ok: true, time: new Date().toISOString() })),
  );

  server.tool(
    'get_review_load',
    'Read-only study load for the next `days` study days, for planning study time: grammarDue, ' +
      'vocabDue (overdue count on day 1), newGrammarPlanned; plus reviewedToday. Counts only.',
    { days: z.number().int().min(1).max(14).default(7).describe('How many study days, 1–14') },
    guard('get_review_load', async ({ days }: { days: number }) => ok(await getReviewLoad(days))),
  );
}
