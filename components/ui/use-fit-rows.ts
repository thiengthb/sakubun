'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { fitItemCount } from '@/lib/fit-rows';

/**
 * How many list items fit on screen so a paginated list + its pagination bar sit ENTIRELY within the
 * viewport (no page scroll, controls never pushed off the bottom). Reusable across every paginated
 * MiniServer surface — a data table (`components/data-table.tsx`) or a client card list (via
 * `usePagedList`).
 *
 * Unlike a fixed "reserve N px" guess, this measures the WHOLE layout from the DOM:
 *   - `topRef`     — the rows/cards container; its top edge and its first child's height are measured
 *                    (so the actual row/card height is used, not an estimate), and for a grid its live
 *                    column count is read from `grid-template-columns`.
 *   - `footerRef`  — the pagination bar; its REAL height is reserved, so a footer that wraps to two
 *                    lines on a narrow screen simply leaves room for fewer rows instead of overflowing.
 *
 * Recomputes on viewport resize and whenever the footer or the content above reflows (ResizeObserver).
 * Returns `null` until first measured — callers fall back to a fixed size meanwhile. The pure math is
 * `lib/fit-rows.ts` (unit-tested); this file is only the measurement glue.
 */
export interface UseFitRowsOptions {
  topRef: RefObject<HTMLElement | null>;
  footerRef?: RefObject<HTMLElement | null>;
  /** Fallback row/card pitch used only until the first row is measured from the DOM. */
  rowHeight: number;
  /** Vertical gap between rows added to the measured row height (a grid's row-gap; 0 for a table). */
  rowGap?: number;
  /** Read the live column count from the container's `grid-template-columns` (a responsive card grid). */
  grid?: boolean;
  bottomGap?: number;
  min?: number;
  max?: number;
  /** Footer height reserved until the footer element is measured. */
  footerFallback?: number;
}

export function useFitRows({
  topRef,
  footerRef,
  rowHeight,
  rowGap = 0,
  grid = false,
  // Only the page's own bottom padding below the footer (PageShell is `pt-6 pb-16` — 64px at the
  // bottom, a reserved gutter for the floating back-to-top button) + a few px of safety. The gap above
  // the footer, the table's horizontal scrollbar and the footer height are all measured into
  // `footerChrome` below. Keep in step with PageShell's `pb-*`: too small and the fitted list ends up
  // under the button, too large and it wastes a row.
  bottomGap = 68,
  min,
  max,
  footerFallback = 56,
}: UseFitRowsOptions): number | null {
  const [count, setCount] = useState<number | null>(null);
  // Last COMMITTED measurement — the anchor for the anti-jitter deadband below. A recompute only
  // adopts a new count when a "hard" input moved (viewport height, the rows' top edge, or the grid's
  // column count); a ±1-row wobble at a constant viewport height is treated as scrollbar/reflow noise
  // and ignored. Without this the count oscillated N <-> N-1 forever at a fit boundary (rendering N
  // rows tips the page into a scrollbar -> width shrinks -> a card/footer wraps -> pitch grows ->
  // recompute to N-1 -> scrollbar gone -> back to N -> ...), which is the visible "giật giật".
  const committed = useRef<{
    count: number;
    innerHeight: number;
    top: number;
    perRow: number;
  } | null>(null);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const top = topRef.current;
        if (!top) return;
        const topRect = top.getBoundingClientRect();
        // A hidden tab (Radix keeps inactive TabsContent mounted with display:none) or a not-yet-
        // rendered list measures as 0 — skip so we never clobber a good value with garbage.
        const childCount = top.childElementCount;
        if (topRect.height <= 0 || childCount === 0) return;

        let itemsPerRow = 1;
        if (grid) {
          const tracks = getComputedStyle(top)
            .gridTemplateColumns.split(' ')
            .filter((t) => t && t !== 'none');
          itemsPerRow = Math.max(1, tracks.length);
        }

        // AVERAGE row pitch (total height / rendered rows), not the first row: table rows vary in
        // height (furigana ruby makes some taller) and cards vary with note lines, so keying off row 1
        // under-counts and overflows. Dividing the whole block includes the inter-row gaps for free.
        const visualRows = Math.max(1, Math.ceil(childCount / itemsPerRow));
        const pitch = topRect.height > 0 ? topRect.height / visualRows : rowHeight + rowGap;

        // Reserve the ACTUAL chrome between the rows and the bottom of the footer — the gap above the
        // footer, the table's own horizontal scrollbar (a wide table has one, ~15px, sitting right
        // there), and the footer's real height — by measuring footer.bottom − rows.bottom in one shot.
        // This difference is constant as rows are added/removed (both edges shift together), so no loop.
        const footEl = footerRef?.current;
        const footerChrome = footEl
          ? footEl.getBoundingClientRect().bottom - topRect.bottom
          : footerFallback;

        const innerHeight = window.innerHeight;
        const next = fitItemCount({
          viewportHeight: innerHeight,
          rowsTop: topRect.top,
          footerHeight: footerChrome,
          rowHeight: pitch,
          itemsPerRow,
          bottomGap, // now only the page's own bottom padding below the footer
          min,
          max,
        });

        // Anti-jitter deadband. A "hard" change (viewport height moved, the rows' top edge moved, or
        // the grid re-columned) always commits. Otherwise a small ±one-row difference at a stable
        // viewport is the scrollbar/reflow flap described above — hold the current count steady.
        const prev = committed.current;
        const hardChange =
          !prev ||
          itemsPerRow !== prev.perRow ||
          Math.abs(innerHeight - prev.innerHeight) >= 1 ||
          Math.abs(topRect.top - prev.top) >= 2;
        if (prev && !hardChange && Math.abs(next - prev.count) <= itemsPerRow) return;

        committed.current = { count: next, innerHeight, top: topRect.top, perRow: itemsPerRow };
        setCount((prevCount) => (prevCount === next ? prevCount : next));
      });
    };

    compute();
    window.addEventListener('resize', compute);
    // The footer height changes at breakpoints (wrap) and content above can reflow without a window
    // resize (a toolbar wrapping, a tab's list toggling columns) — observe both. NOT document.body:
    // its height changes on every count change (and on scroll-induced reflow), which fed the very
    // oscillation the deadband above guards against; top + footer already cover late-mounting rows.
    const ro = new ResizeObserver(compute);
    if (footerRef?.current) ro.observe(footerRef.current);
    if (topRef.current) ro.observe(topRef.current);
    return () => {
      window.removeEventListener('resize', compute);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [topRef, footerRef, rowHeight, rowGap, grid, bottomGap, min, max, footerFallback]);

  return count;
}
