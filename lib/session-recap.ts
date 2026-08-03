// "Where did I leave off?" — one derived line at session open (plan step 5.5).
//
// WHAT THIS IS *NOT*, AND WHY. Plan §9 specified a stored three-line session digest, written by Claude
// at session end, kept under three self-destruct conditions (auto-written · <= 3 lines, no web surface ·
// delivered inside get_stats, no dedicated tool) with the instruction to DELETE the step rather than
// compromise any of them. Building it exposed a collision the plan did not foresee:
//
//   THERE IS NO SESSION-END EVENT. The app never learns that a session ended — the learner simply stops
//   typing. Every tool call belongs to the practice loop, and the last `submit_review` of a session is
//   indistinguishable from any other while it is happening. So "written at session end" needs either a
//   dedicated end-of-session tool (breaks condition 3, and is precisely the kind of call the study plan
//   proved decays to never-called) or a write on EVERY turn so the last one happens to survive (a
//   per-turn cost for a once-per-session value, and plan risk 5 is about exactly that).
//
// So the STORAGE was deleted and the content is DERIVED instead — which satisfies all three conditions
// by construction rather than by discipline: nothing is written, nothing can go stale, nothing can be
// maintained wrongly. What derivation cannot produce is Claude's own judgement about the session, and
// that half already shipped as the asserted notes (`lib/learner-notes.ts`), which are already delivered
// at session open. Nothing was lost; one mechanism replaced two.
//
// Recorded here rather than only in the plan so a later session cannot quietly reintroduce the stored
// version without meeting the same argument.

import { prisma } from '@/lib/db';
import { studyDayKey } from '@/lib/streak';

/** Patterns named in the recap line. More than a few stops being a pointer and becomes a report. */
export const MAX_SHAKY = 3;

/**
 * How far back to scan for the previous session's rows. A study day is at most 24h wide; 36h covers it
 * with room for the cutoff shift, and keeps the query bounded.
 */
const LOOKBACK_MS = 36 * 3600000;

const SCAN_CAP = 400;

export interface SessionRecap {
  /** Whole study-days between the last session and now. 0 = the learner already studied today. */
  daysAgo: number;
  /** Sentences graded in that session. */
  sentences: number;
  reviews: number;
  /** Patterns missed (rating <= 2) in that session, worst first — the actual "pick up here". */
  shaky: { itemId: string; expression: string; misses: number }[];
}

/**
 * Reconstruct the learner's most recent study day.
 *
 * Returns null when they have never reviewed anything: a first-time learner must not be told where they
 * left off, the same "an empty model looks empty" rule the dossier follows.
 */
export async function getSessionRecap(
  userId: string,
  cutoffHour: number,
  now: Date = new Date(),
): Promise<SessionRecap | null> {
  const last = await prisma.reviewLog.findFirst({
    where: { userId },
    orderBy: { reviewedAt: 'desc' },
    select: { reviewedAt: true },
  });
  if (!last) return null;

  const dayKey = studyDayKey(last.reviewedAt, cutoffHour);
  const rows = await prisma.reviewLog.findMany({
    where: { userId, reviewedAt: { gte: new Date(last.reviewedAt.getTime() - LOOKBACK_MS) } },
    select: {
      itemId: true,
      rating: true,
      reviewedAt: true,
      sentenceId: true,
      item: { select: { expression: true } },
    },
    orderBy: { reviewedAt: 'desc' },
    take: SCAN_CAP,
  });
  // Filtered on the STUDY-day key rather than a raw 24h window, so a learner whose day starts at 04:00
  // gets the same session boundary the streak uses. Two definitions of "a day" in one app is a bug.
  const session = rows.filter((r) => studyDayKey(r.reviewedAt, cutoffHour) === dayKey);

  const missesByItem = new Map<string, { expression: string; misses: number }>();
  const sentences = new Set<string>();
  for (const row of session) {
    if (row.sentenceId) sentences.add(row.sentenceId);
    // A miss on a since-deleted item cannot be pointed at, so it is counted in `reviews` and nowhere
    // else (invariant #2 keeps the log; the pattern is gone).
    if (row.rating > 2 || !row.itemId || !row.item) continue;
    const entry = missesByItem.get(row.itemId) ?? { expression: row.item.expression, misses: 0 };
    entry.misses += 1;
    missesByItem.set(row.itemId, entry);
  }

  const todayKey = studyDayKey(now, cutoffHour);
  const dayMs = 86_400_000;
  // Difference in study-days, computed from the keys so a cutoff shift cannot make it off-by-one.
  const daysAgo = Math.max(0, Math.round((Date.parse(todayKey) - Date.parse(dayKey)) / dayMs));

  return {
    daysAgo,
    sentences: sentences.size,
    reviews: session.length,
    shaky: [...missesByItem.entries()]
      .map(([itemId, e]) => ({ itemId, expression: e.expression, misses: e.misses }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, MAX_SHAKY),
  };
}
