import { needsWork, type QualityTier } from '@/lib/enrichment-quality';

export const CARD_FILTERS = [
  { value: 'all', label: 'Mọi mục' },
  { value: 'needs-work', label: 'Thẻ chưa đạt' },
  { value: 'no', label: 'Chưa có thẻ' },
  { value: 'thin', label: 'Thẻ còn thiếu' },
  { value: 'outdated', label: 'Thẻ format cũ' },
  { value: 'yes', label: 'Thẻ đủ' },
] as const;

export type CardFilterValue = (typeof CARD_FILTERS)[number]['value'];

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
    case 'yes':
      return !needsWork(tier);
    default:
      return true;
  }
}
