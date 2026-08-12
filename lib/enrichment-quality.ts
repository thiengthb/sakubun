// What "the enrichment card is not good enough" means, OBJECTIVELY. Pure (no DB) so it is testable and
// so both the MCP surface and the web can score a card the same way.
//
// The problem it solves: `Item.enrichment` was a nullable TEXT column and the only question anyone
// asked about it was "is it null?". So a 44-character card with no `usage` — which `parseEnrichment`
// rejects outright, leaving the tutor with NOTHING — sat in the same bucket as a complete 315-character
// one, and `enrich_backlog`'s `enriched: false` filter would never revisit it (verified in a runtime
// lab, 2026-07-26). "Thin", "broken" and "outdated" are distinct, actionable states; "null" is not
// enough to express any of them.
//
// The five completeness dimensions are NOT invented here. They are the five a complete grammar entry
// carries in Bunpro — conjugation/structure, usage explanation, synonymous points, warnings about
// common mistakes, and multiple examples — so this is a check against a known-good reference product
// rather than an opinion.
//
// KIND-AWARE since 2026-08-12, and that is the second bug of the same shape as the first. Those five
// dimensions describe a GRAMMAR entry, and every caller scored vocabulary against them too, so a word
// card was measured on "cách chia / cách gắn" and "phân biệt mẫu gần nghĩa" — one dimension a word does
// not have, one that means something different for a word. Both directions were wrong, not just the
// pedantic one: a word card with a single junk `structure` line and no synonyms scored `ok`, while an
// honest one carrying 同義語 + 対義語 + collocations scored `thin` forever and kept reappearing in the
// health proposals. So the bar was simultaneously too lax and impossible to satisfy, on half the library.
//
// `kind` is a REQUIRED parameter rather than an optional one defaulting to GRAMMAR. An optional flag is
// a flag that must be remembered at 8 call sites; a required one makes the compiler visit all 8. That is
// the rule this repo arrived at the hard way (lib/exercise-types.ts, lib/turn-labels.ts).

import {
  CURRENT_ENRICHMENT_VERSION,
  enrichmentSchema,
  parseEnrichment,
  type Enrichment,
  type Provenance,
} from '@/lib/enrichment';
import { VOCAB_KIND, asItemKind, type ItemKind } from '@/lib/item-kinds';

/**
 * Quality tiers, worst to best. Each maps to a DIFFERENT repair, which is the reason they are separate
 * states rather than a single score:
 *  - `missing`  — no card at all           → write one (enrich_items)
 *  - `broken`   — present but unparseable  → REWRITE it; the tutor currently receives nothing
 *  - `thin`     — parses, but incomplete   → PATCH the gaps (patch_enrichment), never overwrite
 *  - `outdated` — complete for an OLDER format version → re-enrich to the current shape
 *  - `ok`       — meets the current bar
 *  - `rich`     — comfortably beyond it
 */
export const QUALITY_TIERS = ['missing', 'broken', 'thin', 'outdated', 'ok', 'rich'] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

/** A dimension the card is expected to carry, and how to tell whether it does. */
interface Dimension {
  key: string;
  /** Vietnamese, learner-facing: it is shown in the proposal line ("thiếu: bẫy, phân biệt"). */
  label: string;
  present: (card: Enrichment) => boolean;
}

/**
 * `usage` is the one field `enrichmentSchema` already requires, so it is never empty here — but a
 * one-word usage line is not an explanation. A floor of a few characters separates a real sentence
 * from a placeholder without pretending to judge prose quality.
 */
const MIN_USAGE_CHARS = 25;

/** How many worked examples a card owes (the mini-lesson asks for two). */
const MIN_EXAMPLES = 2;

/** How many collocations make a word card useful for COMPOSING rather than just recognising. */
const MIN_VOCAB_COLLOCATIONS = 2;

/** All worked examples on the card, canonical one included. */
function allExamples(c: Enrichment): Enrichment['examples'] {
  return [c.example, ...c.examples];
}

/** Synonyms and antonyms together — what "the card places this word among its neighbours" means. */
function relationCount(c: Enrichment): number {
  return c.synonyms.length + c.antonyms.length;
}

// The canonical `example` counts toward the total: a card with one good example plus one extra meets
// the bar, and old cards are not punished for the shape the schema used to have.
const usageDimension: Dimension = {
  key: 'usage',
  label: 'cách dùng',
  present: (c) => c.usage.trim().length >= MIN_USAGE_CHARS,
};
const pitfallsDimension: Dimension = {
  key: 'pitfalls',
  label: 'bẫy hay gặp',
  present: (c) => c.pitfalls.length >= 1,
};

const GRAMMAR_DIMENSIONS: readonly Dimension[] = [
  {
    key: 'structure',
    label: 'cách chia / cách gắn',
    present: (c) => c.structure.length >= 1,
  },
  usageDimension,
  {
    key: 'examples',
    label: 'ví dụ',
    present: (c) => allExamples(c).length >= MIN_EXAMPLES,
  },
  pitfallsDimension,
  { key: 'contrasts', label: 'phân biệt mẫu gần nghĩa', present: (c) => c.contrasts.length >= 1 },
];

const VOCAB_DIMENSIONS: readonly Dimension[] = [
  usageDimension,
  {
    key: 'examples',
    // The label names the translation on purpose: it is the half that goes missing. `vi` is required by
    // `exampleSchema`, but `min(1)` accepts a single space — so a whitespace-only gloss parses, renders
    // as an empty line under the Japanese, and would otherwise count as a satisfied dimension.
    label: 'ví dụ có dịch tiếng Việt',
    present: (c) => {
      const examples = allExamples(c);
      return examples.length >= MIN_EXAMPLES && examples.every((e) => e.vi.trim().length > 0);
    },
  },
  {
    key: 'collocations',
    // For a word this is the analogue of grammar's `structure`: 会議[に]出る, 約束[を]守る — the frame it
    // actually appears in. Knowing a gloss without the frame is what produces textbook-correct,
    // unnatural Japanese, so it is a completeness dimension for vocabulary rather than a bonus.
    label: 'cụm / khung câu hay đi kèm',
    present: (c) => c.collocations.length >= MIN_VOCAB_COLLOCATIONS,
  },
  {
    key: 'relations',
    label: 'từ đồng nghĩa / trái nghĩa',
    // Synonyms OR antonyms — never both required. 会議, 準備, ほとんど have no honest 対義語, and a bar
    // that demands one is a bar satisfied by inventing one. Having both is scored as richness instead.
    present: (c) => relationCount(c) >= 1,
  },
  pitfallsDimension,
];

export function dimensionsFor(kind: ItemKind): readonly Dimension[] {
  return kind === VOCAB_KIND ? VOCAB_DIMENSIONS : GRAMMAR_DIMENSIONS;
}

/**
 * Does this card carry all five dimensions for its kind? Exported because `lib/enrichment-merge.ts`
 * decides whether a patched card may be STAMPED with the current version, and that decision must use
 * this definition of "complete" rather than a second copy of it.
 */
export function meetsCurrentBar(card: Enrichment, kind: ItemKind): boolean {
  return dimensionsFor(kind).every((d) => d.present(card));
}

/** Everything past the completeness bar that makes a card genuinely good rather than merely valid. */
function richnessBonus(card: Enrichment, kind: ItemKind): number {
  let bonus = 0;
  if (card.register) bonus += 1;
  if (card.examples.some((e) => e.jaRuby)) bonus += 1; // furigana-ready examples
  if (card.pitfalls.length >= 2) bonus += 1;

  if (kind === VOCAB_KIND) {
    if (card.synonyms.length >= 2) bonus += 1;
    // Having a real antonym is worth points precisely BECAUSE it is not required — this is where a card
    // that names the opposite gets credit without a card that honestly cannot being called incomplete.
    if (card.antonyms.length >= 1) bonus += 1;
    if (card.collocations.length >= 4) bonus += 1;
    // Part of speech / conjugation class / transitivity pair, when the author bothered.
    if (card.structure.length >= 1) bonus += 1;
    return bonus;
  }

  if (card.collocations.length >= 2) bonus += 1;
  if (card.contrasts.length >= 2) bonus += 1;
  return bonus;
}

export interface QualityReport {
  tier: QualityTier;
  /** 0-100. A blunt instrument for sorting a backlog, NOT a judgement of the prose. */
  score: number;
  /** Vietnamese labels of the dimensions the card lacks — what makes a proposal specific. */
  missing: string[];
  /** Card format version (1 for every card written before versioning existed). */
  v: number;
  /** True when the card would not survive `parseEnrichment` — the tutor gets nothing at all. */
  broken: boolean;
  /** Who wrote the card and how sure they were, when the card says (2026-07-27). Absent on old cards. */
  provenance?: Provenance;
}

/**
 * Score a RAW stored enrichment string (the `Item.enrichment` column).
 *
 * Deliberately takes the raw string rather than a parsed card: "it does not parse" is one of the
 * states being reported, and a caller that had to parse first could not distinguish `broken` from
 * `missing`.
 */
export function scoreEnrichment(raw: string | null | undefined, kind: string): QualityReport {
  const dimensions = dimensionsFor(asItemKind(kind));

  if (!raw || !raw.trim()) {
    return {
      tier: 'missing',
      score: 0,
      missing: dimensions.map((d) => d.label),
      v: 0,
      broken: false,
    };
  }

  const card = parseEnrichment(raw);
  if (!card) {
    // Present but unusable. Try to recover just the version, so a re-enrich can report what it replaced.
    let v = 1;
    try {
      const loose = JSON.parse(raw) as { v?: unknown };
      if (typeof loose.v === 'number') v = loose.v;
    } catch {
      // not even JSON — v stays at the assumed 1
    }
    return {
      tier: 'broken',
      score: 0,
      missing: dimensions.map((d) => d.label),
      v,
      broken: true,
    };
  }

  const missingDims = dimensions.filter((d) => !d.present(card));
  const met = dimensions.length - missingDims.length;
  const bonus = richnessBonus(card, asItemKind(kind));
  // Completeness is worth 80 of the 100 points; richness the remaining 20. A card can therefore be
  // "complete but plain" (80) or "incomplete but detailed" (< 80) — the tier, not the score, decides
  // what to DO about it.
  const score = Math.round((met / dimensions.length) * 80 + Math.min(bonus, 5) * 4);

  const tier: QualityTier =
    missingDims.length > 0
      ? 'thin'
      : card.v < CURRENT_ENRICHMENT_VERSION
        ? 'outdated'
        : bonus >= 3
          ? 'rich'
          : 'ok';

  return {
    tier,
    score,
    missing: missingDims.map((d) => d.label),
    v: card.v,
    broken: false,
    ...(card.provenance ? { provenance: card.provenance } : {}),
  };
}

/** Tiers that warrant a proposal to the learner. `ok`/`rich` need nothing. */
export const NEEDS_WORK: readonly QualityTier[] = ['missing', 'broken', 'thin', 'outdated'];

export function needsWork(tier: QualityTier): boolean {
  return NEEDS_WORK.includes(tier);
}

/** Vietnamese label per tier, for the proposal line and the web badge (ONE source for both surfaces). */
export const TIER_LABELS: Record<QualityTier, string> = {
  missing: 'chưa có thẻ',
  broken: 'thẻ lỗi (không đọc được)',
  thin: 'thẻ còn thiếu',
  outdated: 'thẻ theo format cũ',
  ok: 'thẻ đủ',
  rich: 'thẻ chi tiết',
};

/** Re-export so a consumer scoring cards does not need a second import. */
export { CURRENT_ENRICHMENT_VERSION, enrichmentSchema };
