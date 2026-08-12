// THE canonical item kinds. A leaf module — NO imports — for the same reason lib/exercise-types.ts is
// one: everything that needs to branch on kind can reach it, including client components, without
// dragging Prisma or zod along.
//
// Why it exists (2026-08-12). `const GRAMMAR_KIND = 'GRAMMAR'` was declared privately in
// lib/analytics.ts, lib/groups.ts and lib/practice.ts — three copies of a two-value mapping. That was
// harmless while nothing depended on the pair being COMPLETE; it stopped being harmless the moment the
// enrichment quality bar became kind-aware, because "which kinds exist" now decides which set of
// completeness dimensions a card is measured against. A fourth private copy would be the copy that
// gets forgotten (the lesson written up in lib/turn-labels.ts).

export const GRAMMAR_KIND = 'GRAMMAR';
export const VOCAB_KIND = 'VOCAB';

export const ITEM_KINDS = [GRAMMAR_KIND, VOCAB_KIND] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

/**
 * Read a raw `Item.kind` string as a kind, defaulting to GRAMMAR.
 *
 * The default is not laziness: `kind` is a plain TEXT column (legacy "WORD" rows lived there until
 * 2026-07-07), so a caller holding a DB string cannot prove it is one of the two. GRAMMAR is the safe
 * side — it is what the app was for the first month, and every grammar-shaped default it produces is a
 * default the code already handled.
 */
export function asItemKind(kind: string | null | undefined): ItemKind {
  return kind === VOCAB_KIND ? VOCAB_KIND : GRAMMAR_KIND;
}

export function isVocab(kind: string | null | undefined): boolean {
  return kind === VOCAB_KIND;
}
