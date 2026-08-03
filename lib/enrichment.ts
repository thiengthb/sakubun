// Enrichment card — Claude-generated usage data stored per item (Item.enrichment JSON column).
// Feeds sentence generation (collocations/pitfalls) and mini-lessons (structure/contrasts).

import { z } from 'zod';

// One worked example. `jaRuby` is the same `漢字[かな]` markup used for staged sentences (sourceRuby),
// letting the app show furigana over an example and keep the reading in sync with the karaoke sweep.
// OPTIONAL on purpose: every card enriched before 2026-07-20 lacks it, and those cards must keep
// parsing. Missing ruby degrades to audio-without-furigana, never to a broken card — a required field
// would have invalidated the whole existing library for data only a model can regenerate.
export const exampleSchema = z.object({
  ja: z.string().min(1),
  vi: z.string().min(1),
  jaRuby: z.string().optional(),
});

/**
 * How many entries each list field holds, at most.
 *
 * Named constants rather than literals inside the schema because `lib/enrichment-merge.ts` has to
 * enforce the SAME ceilings while appending — a patch that appended past the cap would produce a card
 * the schema then refuses to parse, i.e. it would turn a "thin" card into a "broken" one.
 */
export const ENRICHMENT_CAPS = {
  structure: 6,
  collocations: 8,
  examples: 4,
  pitfalls: 5,
  contrasts: 5,
} as const;

/**
 * WHERE a card came from and how sure its author was (2026-07-27, plan §12).
 *
 * The reason it exists is the SHARED library: a card forked from another member arrives with no way to
 * judge it, and "someone published this" is not evidence. It also gives the CARD_SUSPECT path something
 * to reason WITH — a card that declares low confidence and disagrees with the model is a different
 * situation from one that declares high confidence and disagrees.
 *
 * Deliberately NOT a timestamp: `Item.enrichedAt` already holds that, and a second copy would drift.
 * Every field is optional and the whole block is optional — every card written before today has none,
 * and must keep parsing (the `jaRuby` back-compat rule).
 */
export const provenanceSchema = z.object({
  /** Which model wrote it, as the model names itself (e.g. "claude-opus-5"). */
  by: z.string().min(1).max(60).optional(),
  /** The author's OWN reading of how solid the card is — not a computed score. */
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  /** What it was drawn from, when that is worth knowing ("JLPT N2 textbook", "learner's own errors"). */
  basedOn: z.string().min(1).max(120).optional(),
});

export type Provenance = z.infer<typeof provenanceSchema>;

/** A near-synonym and how it differs. Exported so `patch_enrichment` validates against ONE shape. */
export const contrastSchema = z.object({ with: z.string().min(1), note: z.string().min(1) });

export const enrichmentSchema = z.object({
  // FORMATION / conjugation — how the pattern ATTACHES to each word class (Bunpro's "GrammarStructure";
  // 2026-07-13). One rule per line/entry, e.g. "動詞辞書形 + ばかりに", "な形容詞 + な + ばかりに",
  // "名詞 + である + ばかりに". This is the "cấu trúc / cách chia" the enrichment was missing.
  structure: z.array(z.string().min(1)).max(ENRICHMENT_CAPS.structure).default([]),
  // One-line how/when to use it (vi). For grammar: nuance / when to reach for it.
  usage: z.string().min(1),
  // Common collocations / set phrases the item actually appears in (ja).
  collocations: z.array(z.string()).max(ENRICHMENT_CAPS.collocations).default([]),
  // ONE short canonical example (kept for back-compat + generation); `examples` adds a few more.
  example: exampleSchema,
  // Extra worked examples beyond the canonical one — richer detail view (Bunpro shows several).
  examples: z.array(exampleSchema).max(ENRICHMENT_CAPS.examples).default([]),
  // Mistakes learners typically make with this item (vi).
  pitfalls: z.array(z.string()).max(ENRICHMENT_CAPS.pitfalls).default([]),
  // Near-synonyms / easily-confused items and how they differ (vi note).
  contrasts: z.array(contrastSchema).max(ENRICHMENT_CAPS.contrasts).default([]),
  // Register/formality note when relevant (vi), e.g. "trang trọng, văn viết".
  register: z.string().optional(),
  // CARD FORMAT VERSION (2026-07-26). Every card written before this existed parses as v1 (the
  // default), which is the whole point: raising CURRENT_ENRICHMENT_VERSION is the ONE lever that makes
  // the entire library self-report as outdated, so "the card is not in the new format" becomes a
  // MEASURABLE state instead of a feeling. Scored by lib/enrichment-quality.ts.
  v: z.number().int().min(1).default(1),
  // `.catch(undefined)`: a malformed provenance block DROPS ITSELF instead of failing the parse. Without
  // it, one bad optional field would turn a complete card into `broken` — the tutor would then read
  // NOTHING from an otherwise perfect card, which is a far worse outcome than losing an attribution.
  provenance: provenanceSchema.optional().catch(undefined),
});

/**
 * The format cards are expected to be in NOW. Bump this whenever the completeness bar rises (a new
 * required dimension, a changed shape) — every existing card then scores as `outdated` and the
 * re-enrich sweep has a precise target list. Never bump it for a cosmetic change: each bump asks the
 * learner (or a batch job) to regenerate real content.
 */
export const CURRENT_ENRICHMENT_VERSION = 2;

export type Enrichment = z.infer<typeof enrichmentSchema>;

/** What the tutor actually reads. Deliberately NOT the stored card — see `toTutorCard`. */
export interface TutorCard {
  structure: string[];
  usage: string;
  collocations: string[];
  pitfalls: string[];
  contrasts: { with: string; note: string }[];
  register?: string;
  /** Worked examples, WITHOUT ruby. Present only for a pattern being introduced. */
  examples?: { ja: string; vi: string }[];
}

/** Examples shown when introducing a new pattern; the protocol's mini-lesson asks for two. */
const INTRO_EXAMPLES = 2;

/**
 * Trim a stored enrichment card down to what the MCP tutor protocol actually references, before it
 * is serialized into a tool result that Claude re-reads on EVERY turn of a session.
 *
 * Two cuts, both measured rather than guessed (2-item batch, 2026-07-20):
 * - `jaRuby` (151 chars) is furigana markup for the APP's renderer. Claude never reads a reading out
 *   of the card — it writes its own `sourceRuby` for the sentence it composes.
 * - `example` + `examples` (544 chars) are only used by the 4-part mini-lesson for an `isNew`
 *   pattern. A review item carries them for nothing, and most of a batch is review items.
 *
 * Everything the protocol names by hand stays: `usage`, `collocations`, `pitfalls`, `contrasts`
 * (quoted when correcting a confusion), `structure` (how the pattern attaches), `register`.
 */
export function toTutorCard(raw: string | null | undefined, isNew: boolean): TutorCard | null {
  const card = parseEnrichment(raw);
  if (!card) return null;

  const trimmed: TutorCard = {
    structure: card.structure,
    usage: card.usage,
    collocations: card.collocations,
    pitfalls: card.pitfalls,
    contrasts: card.contrasts,
  };
  if (card.register) trimmed.register = card.register;

  if (isNew) {
    // The canonical `example` first, then extras, capped — and stripped of ruby.
    trimmed.examples = [card.example, ...card.examples]
      .slice(0, INTRO_EXAMPLES)
      .map(({ ja, vi }) => ({ ja, vi }));
  }
  return trimmed;
}

export function parseEnrichment(raw: string | null | undefined): Enrichment | null {
  if (!raw) return null;
  try {
    const result = enrichmentSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
