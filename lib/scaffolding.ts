import { prisma } from '@/lib/db';
import { listItems } from '@/lib/practice';
import { normalizeExpression, stripDecoration } from '@/lib/normalize';
import { JLPT_LEVELS, type JlptLevel } from '@/lib/settings-schema';

// DECLARED SCAFFOLDING (plan 2026-07-26-natural-generation, section 5 + Phase 3).
//
// `PRACTICE_PROTOCOL` lets Claude weave in unscheduled lower-level grammar as material — "NOT graded
// and NOT listed". Nothing recorded it, so two things were true at once: a pattern the learner has
// never met could sail past unexplained, and the protocol's own rule "NEVER add grammar HARDER than
// the level being drilled" had no enforcement whatsoever. Both are invisible failures — nothing errors,
// the exercise just quietly teaches something it never mentioned.
//
// WHY CLAUDE DECLARES INSTEAD OF THE SERVER PARSING. The literal ask was to segment the generated
// sentence server-side and detect unknown grammar. Ruled out: sakubun ships no morphological analyser
// on purpose (the inverted trust model vs yakudoku: the model declares, the server verifies against
// the library — it does not re-parse Japanese), so adding MeCab/fugashi would
// break a considered architectural choice for a job the model does better anyway — it KNOWS which
// structures it reached for. The server's job is the part the model cannot do: check those structures
// against this learner's actual library.

/** What the learner's library says about a pattern Claude used beyond the scheduled batch. */
export type ScaffoldStatus =
  /** In their library already — safe material, no action needed. */
  | 'known'
  /** Not theirs, but another member published it — `fork_shared_items` can take a copy. */
  | 'availableInSharedLibrary'
  /** Nowhere. They are meeting it for the first time, inside an exercise about something else. */
  | 'newToLearner';

export interface ScaffoldPattern {
  /** As Claude declared it, verbatim — so the offer it relays matches what it said. */
  expression: string;
  status: ScaffoldStatus;
  /** The matched item's level, when there is a match. */
  level: JlptLevel | null;
  /** Present when `known` (their item) or `availableInSharedLibrary` (the public source item). */
  itemId?: string;
  /**
   * TRUE when this pattern is HARDER than the level being drilled. The protocol has always forbidden
   * this; until now nothing could see it happen. Null level (unknown pattern) cannot be judged, so it
   * is false rather than a guess.
   */
  aboveDrilledLevel: boolean;
}

/** Difficulty rank: N5 is easiest. `JLPT_LEVELS` is already ordered, so the index IS the rank. */
function rank(level: string | null | undefined): number | null {
  const i = JLPT_LEVELS.indexOf(level as JlptLevel);
  return i === -1 ? null : i;
}

/** Is `candidate` harder than `drilled`? Unknown either side ⇒ no claim. */
export function isAboveLevel(candidate: string | null, drilled: string | null): boolean {
  const a = rank(candidate);
  const b = rank(drilled);
  if (a === null || b === null) return false;
  return a > b;
}

/** Cap: a sentence declaring more than this is not scaffolding, it is a second exercise. */
export const MAX_EXTRA_PATTERNS = 5;

/**
 * The level this sentence is drilling — the HARDEST level among its scheduled items.
 *
 * Deliberately the hardest rather than the TARGET's: a declared pattern harder than everything the
 * batch scheduled is unambiguously the violation the protocol forbids, while a pattern sitting between
 * the target and a secondary is a judgement call, and a rule that fires on judgement calls gets ignored.
 */
export async function drilledLevelOf(
  itemIds: readonly string[],
): Promise<JlptLevel | null> {
  if (itemIds.length === 0) return null;
  // Tenant-scoped by userId — lib/db.ts throws on a user-owned query without one, and an id from
  // another account must never widen what counts as "already being drilled".
  const rows = await prisma.item.findMany({
    where: { id: { in: [...itemIds] } },
    select: { level: true },
  });
  let hardest: number | null = null;
  for (const r of rows) {
    const i = rank(r.level);
    if (i !== null && (hardest === null || i > hardest)) hardest = i;
  }
  return hardest === null ? null : JLPT_LEVELS[hardest];
}

/**
 * Classify the patterns Claude declared it used beyond the scheduled batch.
 *
 * Matching goes through the SHARED normaliser, and that is not a detail: the library stores
 * 「〜ざるを得ない」 while a model quotes it back a dozen ways, and a lookup that missed would report a
 * pattern the learner owns as brand new — then offer to add a duplicate. That exact bug was found by
 * driving the real tool (2026-07-27: "a normalizer used only for COMPARISON is half a normalizer"),
 * which is why the search term is decoration-stripped and the comparison is done on the
 * fully normalised key.
 */
export async function classifyExtraPatterns(
  patterns: readonly string[],
  drilledLevel: string | null,
): Promise<ScaffoldPattern[]> {
  const wanted = patterns
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_EXTRA_PATTERNS);
  if (wanted.length === 0) return [];

  return Promise.all(
    wanted.map(async (expression) => {
      const search = stripDecoration(expression);
      const key = normalizeExpression(expression);
      // A LIKE search can return near-misses (a meaning fragment matches several rows), so the
      // decision is made on the normalised KEY, never on "the search returned something".
      const mine = await listItems({ kind: 'GRAMMAR', search, limit: 20 });

      const own = mine.find((i) => normalizeExpression(i.expression) === key);
      if (own) {
        return {
          expression,
          status: 'known' as const,
          level: (own.level as JlptLevel) ?? null,
          itemId: own.itemId,
          aboveDrilledLevel: isAboveLevel(own.level ?? null, drilledLevel),
        };
      }

      // Unknown everywhere: no level to compare, so no level claim is made. The learner is meeting
      // this inside an exercise about something else — that is what the offer in `renderScaffold`
      // exists to surface.
      return {
        expression,
        status: 'newToLearner' as const,
        level: null,
        aboveDrilledLevel: false,
      };
    }),
  );
}
