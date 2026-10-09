export interface FitInput {
  viewportHeight: number;
  rowsTop: number;
  footerHeight: number;
  rowHeight: number;
  itemsPerRow?: number;
  bottomGap?: number;
  min?: number;
  max?: number;
}

export function fitItemCount({
  viewportHeight,
  rowsTop,
  footerHeight,
  rowHeight,
  itemsPerRow = 1,
  bottomGap = 48,
  min = 5,
  max = 100,
}: FitInput): number {
  const perRow = Math.max(1, Math.floor(itemsPerRow));
  const pitch = Math.max(1, rowHeight);
  const available = viewportHeight - rowsTop - footerHeight - bottomGap;
  const rows = Math.max(1, Math.floor(available / pitch));
  const items = rows * perRow;
  const lo = Math.max(1, min);
  return Math.min(max, Math.max(lo, items));
}
