import type { FieldSkeleton } from '@/components/layout/page-skeleton';

// ItemFields' grid, for the add and edit loading screens: expression and reading side by side,
// meaning across, the level on its own half, notes across.
export const ITEM_FIELDS: FieldSkeleton[] = [
  { half: true, count: true },
  { half: true, count: true },
  { count: true },
  { half: true },
  { area: true },
];
