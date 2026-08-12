// The "Thẻ chi tiết" filter — ONE definition, used by the grammar table and the vocab table.
//
// It lived inside components/resources/items-table.tsx, under the comment "Riêng của bảng ngữ pháp —
// từ vựng không có thẻ chi tiết". That comment was false: `Item.enrichment` has no kind restriction and
// `enrich_items` writes cards for words too. The grammar store therefore had a content-hole filter that
// found 150 uncarded N5 patterns, while the vocab store had no way to ask the same question at all.
//
// Extracted rather than copied, because the copy is the failure mode this repo keeps meeting: a filter
// duplicated per table is a filter that gains a tier on one table only (lib/turn-labels.ts).

import { needsWork, type QualityTier } from '@/lib/enrichment-quality';

/**
 * Enrichment-card quality, as a learner-facing filter. Widened from a yes/no presence check to the
 * QUALITY tiers (2026-07-27): "has a card" counted a one-line card as done forever, so the web
 * disagreed with what the tutor already knew. `needs-work` is the one a sweep actually starts from;
 * `broken` is deliberately folded into it rather than given its own row (it is rare, and the card
 * itself names the state when you open it).
 */
export const CARD_FILTERS = [
  { value: 'all', label: 'Mọi mục' },
  { value: 'needs-work', label: 'Thẻ chưa đạt' },
  { value: 'no', label: 'Chưa có thẻ' },
  { value: 'thin', label: 'Thẻ còn thiếu' },
  { value: 'outdated', label: 'Thẻ format cũ' },
  { value: 'yes', label: 'Thẻ đủ' },
] as const;

export type CardFilterValue = (typeof CARD_FILTERS)[number]['value'];

/** Does a row of this card tier survive the chosen filter? `all` keeps everything. */
export function matchesCardFilter(tier: QualityTier, filter: string): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'needs-work':
      return needsWork(tier);
    case 'no':
      return tier === 'missing';
    case 'thin':
      return tier === 'thin';
    case 'outdated':
      return tier === 'outdated';
    // "Thẻ đủ" = actually good, not merely present — the distinction this filter draws.
    case 'yes':
      return !needsWork(tier);
    default:
      // An unknown value comes from a stale URL/sessionStorage key, never from the UI. Showing
      // everything is the honest response; hiding every row would read as "the store is empty".
      return true;
  }
}
