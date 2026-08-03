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
// rather than an opinion. See docs/plans/2026-07-26-agentic-tutor-loop.md §3.

import {
  CURRENT_ENRICHMENT_VERSION,
  enrichmentSchema,
  parseEnrichment,
  type Enrichment,
  type Provenance,
} from '@/lib/enrichment';

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

/** How many worked examples a v2 card owes (the mini-lesson asks for two). */
const MIN_EXAMPLES = 2;

const DIMENSIONS: readonly Dimension[] = [
  {
    key: 'structure',
    label: 'cách chia / cách gắn',
    present: (c) => c.structure.length >= 1,
  },
  {
    key: 'usage',
    label: 'cách dùng',
    present: (c) => c.usage.trim().length >= MIN_USAGE_CHARS,
  },
  {
    key: 'examples',
    label: 'ví dụ',
    // The canonical `example` counts toward the total: a card with one good example plus one extra
    // meets the bar, and old cards are not punished for the shape the schema used to have.
    present: (c) => 1 + c.examples.length >= MIN_EXAMPLES,
  },
  { key: 'pitfalls', label: 'bẫy hay gặp', present: (c) => c.pitfalls.length >= 1 },
  { key: 'contrasts', label: 'phân biệt mẫu gần nghĩa', present: (c) => c.contrasts.length >= 1 },
];

/**
 * Does this card carry all five dimensions? Exported because `lib/enrichment-merge.ts` decides whether
 * a patched card may be STAMPED with the current version, and that decision must use this definition
 * of "complete" rather than a second copy of it.
 */
export function meetsCurrentBar(card: Enrichment): boolean {
  return DIMENSIONS.every((d) => d.present(card));
}

/** Everything past the completeness bar that makes a card genuinely good rather than merely valid. */
function richnessBonus(card: Enrichment): number {
  let bonus = 0;
  if (card.collocations.length >= 2) bonus += 1;
  if (card.contrasts.length >= 2) bonus += 1;
  if (card.pitfalls.length >= 2) bonus += 1;
  if (card.register) bonus += 1;
  if (card.examples.some((e) => e.jaRuby)) bonus += 1; // furigana-ready examples
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
export function scoreEnrichment(raw: string | null | undefined): QualityReport {
  if (!raw || !raw.trim()) {
    return {
      tier: 'missing',
      score: 0,
      missing: DIMENSIONS.map((d) => d.label),
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
      missing: DIMENSIONS.map((d) => d.label),
      v,
      broken: true,
    };
  }

  const missingDims = DIMENSIONS.filter((d) => !d.present(card));
  const met = DIMENSIONS.length - missingDims.length;
  // Completeness is worth 80 of the 100 points; richness the remaining 20. A card can therefore be
  // "complete but plain" (80) or "incomplete but detailed" (< 80) — the tier, not the score, decides
  // what to DO about it.
  const score = Math.round((met / DIMENSIONS.length) * 80 + Math.min(richnessBonus(card), 5) * 4);

  const tier: QualityTier =
    missingDims.length > 0
      ? 'thin'
      : card.v < CURRENT_ENRICHMENT_VERSION
        ? 'outdated'
        : richnessBonus(card) >= 3
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
