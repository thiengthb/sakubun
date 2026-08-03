// Pure layout math for viewport-fitting pagination — how many list items fit BELOW a given top edge
// without pushing the page past the viewport (which is what adds a scrollbar and shoves the pagination
// bar off screen). Kept DOM-free and here in `lib/` so it is unit-tested; the hook that measures the
// real DOM and feeds these numbers lives in `components/ui/use-fit-rows.ts`.

export interface FitInput {
  /** Usable viewport height in px (window.innerHeight). */
  viewportHeight: number;
  /** Distance from the viewport top to where the first row/card starts (getBoundingClientRect().top). */
  rowsTop: number;
  /** Reserved chrome below the last row: in practice the caller measures footer.bottom − rows.bottom,
   *  which covers the gap above the footer, the table's horizontal scrollbar, and the footer itself. */
  footerHeight: number;
  /** Pitch of ONE visual row in px — for a table the average row height, for a grid the card row
   *  height incl. the grid row-gap (the caller derives it from total height ÷ rendered rows). */
  rowHeight: number;
  /** Cards per row for a grid (1 for a table). */
  itemsPerRow?: number;
  /** Any remaining reserve NOT already in `footerHeight` — normally just the page's own bottom padding
   *  below the footer. Kept small; a bias toward fitting one row too FEW (harmless) beats one too many
   *  (which scrolls). */
  bottomGap?: number;
  min?: number;
  max?: number;
}

/**
 * Items that fit below `rowsTop` so the list + its pagination bar sit entirely within the viewport.
 *
 *   available = viewport − rowsTop − footer − bottomGap
 *   rows      = floor(available / rowHeight)      (at least 1)
 *   items     = rows × itemsPerRow, clamped to [min, max]
 *
 * The whole point is to reserve the ACTUAL footer height (measured, not guessed) so the pagination
 * controls never spill below the fold.
 */
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
