// DRY-RUN classification for "the learner pasted real material" (plan step 6.1).
//
// The gap it closes. Every existing import path is a WEB path that needs already-structured input:
// `lib/excel-import.ts` (a spreadsheet), `lib/import-parse.ts` (Mazii's format), the 3-tab
// `ResourceAddDialog` (typed fields). What did not exist is the path the learner actually has material
// in — a work email, a manga page, a mock-exam question, a screenshot they can only paste into a chat.
// Claude can read that; what it cannot do is answer "which of these do I already own", because
// spellings drift (「〜わけにはいかない」 vs わけにはいかない vs ～わけにはいかない).
//
// WRITES NOTHING, on purpose. It returns the same three-bucket shape as `suggest_group`
// (fit / mismatched / notFound) so the app has ONE preview idiom rather than two, and confirmation
// routes to the EXISTING `add_grammar` / `add_vocab` — no new write path (invariant 1).
//
// The dedup key is the shared normalizer (`lib/normalize.ts`), the same one the coach compares with.
// Without it this tool would confidently report a pattern as NEW because the pasted material quoted it,
// and the learner would end up with two rows for one pattern — the exact failure §6 of the plan warned
// about, now on a path that adds in bulk.

import { prisma } from '@/lib/db';
import { normalizeExpression } from '@/lib/normalize';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/practice';

/** Candidates per call. A paste that yields more than this is a textbook chapter, not a lesson. */
export const MAX_IMPORT_CANDIDATES = 40;

/**
 * Public-library rows scanned to find a better copy. One fetch-all + match-in-JS, the same shape the
 * `/library` page already uses, so it inherits the same scale trigger (server-side pagination, deferred
 * in decisions.md 2026-07-24) instead of inventing a second answer to the same question.
 */

export type ImportKind = typeof GRAMMAR_KIND | typeof VOCAB_KIND;

export interface ImportCandidate {
  kind: ImportKind;
  /** As the pasted material wrote it — decoration and all; the normalizer handles the variants. */
  expression: string;
  reading?: string;
  meaningVi: string;
  level?: string;
  notes?: string;
}

export interface DuplicateEntry extends ImportCandidate {
  itemId: string;
  /** The spelling ALREADY in the library — shown because it is often not the pasted one. */
  stored: string;
  /**
   * A suspended duplicate needs UNSUSPENDING, not adding. Reporting it as merely "already there" is
   * how a learner ends up adding a second copy of a pattern they deliberately paused (the same
   * mistake `renderDueBatch` used to make with focus requests).
   */
  suspended: boolean;
}

/** Why a candidate needs a decision rather than a yes/no. */
export type AmbiguousReason = 'other-kind' | 'shared-available' | 'repeated';

export interface AmbiguousEntry extends ImportCandidate {
  reason: AmbiguousReason;
  /** `other-kind`: the item they already own under the other kind. */
  itemId?: string;
  storedKind?: ImportKind;
  /** `shared-available`: a public copy that already carries content worth having. */
  sharedItemId?: string;
  sharedOwner?: string;
  sharedHasCard?: boolean;
}

export interface ImportPreview {
  /** Nothing of theirs matches and no better public copy exists — safe to add as-is. */
  new: ImportCandidate[];
  duplicate: DuplicateEntry[];
  ambiguous: AmbiguousEntry[];
  counts: { new: number; duplicate: number; ambiguous: number };
}

/**
 * Classify pasted candidates against the learner's library and the shared one. READ-ONLY.
 *
 * Order of checks matters and is not arbitrary: an exact same-kind match is the strongest signal, so it
 * wins over everything; a cross-kind match is next (owning 「遠慮」 as vocab means a GRAMMAR row would be
 * a confusing twin, but it is the learner's call); a public copy only matters when they own nothing.
 */
export async function previewImport(
  candidates: readonly ImportCandidate[],
): Promise<ImportPreview> {
  // The learner's WHOLE library, narrow columns. Normalization cannot be expressed in SQL (it strips
  // tilde/wave-dash/quotes and applies NFKC), so matching happens in JS — which means the scan must be
  // complete. A truncated scan would silently classify an owned pattern as NEW, i.e. create the
  // duplicate this module exists to prevent.
  const mine = await prisma.item.findMany({
        select: { id: true, kind: true, expression: true, suspended: true },
  });

  const byKey = new Map<string, (typeof mine)[number]>();
  for (const row of mine) {
    byKey.set(`${row.kind}:${normalizeExpression(row.expression)}`, row);
  }


  const fresh: ImportCandidate[] = [];
  const duplicate: DuplicateEntry[] = [];
  const ambiguous: AmbiguousEntry[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const key = normalizeExpression(candidate.expression);
    const sameKind = byKey.get(`${candidate.kind}:${key}`);
    if (sameKind) {
      duplicate.push({
        ...candidate,
        itemId: sameKind.id,
        stored: sameKind.expression,
        suspended: sameKind.suspended,
      });
      continue;
    }

    // Repeated WITHIN the paste. `addItems` already skips these, but a preview that silently collapses
    // them reports a smaller "new" count than the learner pasted, and they cannot tell why.
    if (seen.has(`${candidate.kind}:${key}`)) {
      ambiguous.push({ ...candidate, reason: 'repeated' });
      continue;
    }
    seen.add(`${candidate.kind}:${key}`);

    const otherKind = candidate.kind === GRAMMAR_KIND ? VOCAB_KIND : GRAMMAR_KIND;
    const crossKind = byKey.get(`${otherKind}:${key}`);
    if (crossKind) {
      ambiguous.push({
        ...candidate,
        reason: 'other-kind',
        itemId: crossKind.id,
        storedKind: otherKind as ImportKind,
      });
      continue;
    }


    fresh.push(candidate);
  }

  return {
    new: fresh,
    duplicate,
    ambiguous,
    counts: { new: fresh.length, duplicate: duplicate.length, ambiguous: ambiguous.length },
  };
}
