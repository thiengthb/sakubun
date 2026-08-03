import { prisma } from '@/lib/db';

/**
 * Which of the `/guide` "Bắt đầu" tutorial steps this learner has ACTUALLY finished, derived from their
 * data — never a stored checklist.
 *
 * Why derived: Diátaxis says every tutorial step must end in a result the learner can OBSERVE, and this
 * tutorial's steps each leave a trace in the DB (a token, an item, a review). A stored checklist would lie
 * after a data reset, on a second browser, or when Claude did the step through MCP instead of the user
 * clicking something. Derived state is always true by construction.
 *
 * One key per tutorial step, in step order. Steps whose completion the app genuinely cannot observe do not
 * get a key — the walkthrough just shows them without a status (better than guessing).
 */
export const START_PROGRESS_KEYS = [
  'signedIn',
  'mcpKey',
  'claudeConnected',
  'items',
  'enrichment',
  'settingsSaved',
  'firstReview',
] as const;

export type StartProgressKey = (typeof START_PROGRESS_KEYS)[number];

export type StartProgress = Record<StartProgressKey, boolean>;

/**
 * Read the learner's real progress. Every count is scoped by `userId` (invariant #5 — the fail-closed
 * Prisma guard throws otherwise; `McpKey` is an auth-layer model and exempt from the guard, but it is
 * scoped here all the same because a cross-user read would be a bug either way).
 *
 * The signals, and why each is the honest one:
 *   signedIn        — reaching this function at all means there is a session.
 *   mcpKey          — a token row exists (step ②'s observable result: "you copied a token").
 *   claudeConnected — a token has a `lastUsedAt`, i.e. Claude Desktop really called the MCP endpoint as
 *                     this user. Chosen over "any review exists" (the plan's open question), which would
 *                     have conflated step ③ (connect) with step ⑦ (first practice session).
 *   items           — the store is not empty.
 *   enrichment      — at least one item carries a Claude-written enrichment card.
 *   settingsSaved   — a Settings ROW exists. `getSettings` falls back to defaults without creating one,
 *                     and only `saveSettings` upserts, so the row's existence means settings were saved
 *                     at least once (from the web form or Claude's `update_settings`).
 *   firstReview     — an append-only ReviewLog row exists (a graded turn happened).
 */
export async function getStartProgress(): Promise<StartProgress> {
  const [mcpKeys, usedKeys, items, enriched, settings, reviews] = await Promise.all([
    prisma.mcpKey.count({}),
    prisma.mcpKey.count({ where: { lastUsedAt: { not: null } } }),
    prisma.item.count({}),
    prisma.item.count({ where: { enrichment: { not: null } } }),
    prisma.settings.count({}),
    prisma.reviewLog.count({}),
  ]);

  return {
    signedIn: true,
    mcpKey: mcpKeys > 0,
    claudeConnected: usedKeys > 0,
    items: items > 0,
    enrichment: enriched > 0,
    settingsSaved: settings > 0,
    firstReview: reviews > 0,
  };
}

/** How many of the tracked steps are done — the "n/7" line above the walkthrough. */
export function countDone(progress: StartProgress): number {
  return START_PROGRESS_KEYS.filter((key) => progress[key]).length;
}
