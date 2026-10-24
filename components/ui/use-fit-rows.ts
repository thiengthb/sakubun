'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { fitItemCount } from '@/lib/core/fit-rows';

export interface UseFitRowsOptions {
  topRef: RefObject<HTMLElement | null>;
  footerRef?: RefObject<HTMLElement | null>;
  /** usePinnedFooter's spacer between the rows and the footer: not part of the footer's chrome. */
  spacerRef?: RefObject<HTMLElement | null>;
  rowHeight: number;
  rowGap?: number;
  grid?: boolean;
  bottomGap?: number;
  min?: number;
  max?: number;
  footerFallback?: number;
}

export function useFitRows({
  topRef,
  footerRef,
  spacerRef,
  rowHeight,
  rowGap = 0,
  grid = false,
  bottomGap = 28,
  min,
  max,
  footerFallback = 56,
}: UseFitRowsOptions): number | null {
  const [count, setCount] = useState<number | null>(null);
  const committed = useRef<{
    count: number;
    innerHeight: number;
    top: number;
    perRow: number;
    footer: number;
  } | null>(null);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const top = topRef.current;
        if (!top) return;
        const topRect = top.getBoundingClientRect();
        const childCount = top.childElementCount;
        // A display:none element measures 0 and has no offsetParent. Report null rather than keep
        // the last count: callers that hold two of these (a table body and a card grid, only one of
        // which is ever visible) tell them apart by which one still answers.
        if (top.offsetParent === null || topRect.height <= 0) {
          committed.current = null;
          setCount((prev) => (prev === null ? prev : null));
          return;
        }
        if (childCount === 0) return;

        let itemsPerRow = 1;
        if (grid) {
          const tracks = getComputedStyle(top)
            .gridTemplateColumns.split(' ')
            .filter((t) => t && t !== 'none');
          itemsPerRow = Math.max(1, tracks.length);
        }

        const visualRows = Math.max(1, Math.ceil(childCount / itemsPerRow));
        const pitch = topRect.height > 0 ? topRect.height / visualRows : rowHeight + rowGap;

        const footEl = footerRef?.current;
        const footerChrome = footEl
          ? footEl.getBoundingClientRect().bottom -
            topRect.bottom -
            (spacerRef?.current?.offsetHeight ?? 0)
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

        const prev = committed.current;
        const hardChange =
          !prev ||
          itemsPerRow !== prev.perRow ||
          Math.abs(innerHeight - prev.innerHeight) >= 1 ||
          Math.abs(topRect.top - prev.top) >= 2 ||
          // The footer appears or goes (a table that fits one page has none).
          Math.abs(footerChrome - prev.footer) >= 2;
        if (prev && !hardChange && Math.abs(next - prev.count) <= itemsPerRow) return;

        committed.current = {
          count: next,
          innerHeight,
          top: topRect.top,
          perRow: itemsPerRow,
          footer: footerChrome,
        };
        setCount((prevCount) => (prevCount === next ? prevCount : next));
      });
    };

    compute();
    window.addEventListener('resize', compute);
    const ro = new ResizeObserver(compute);
    if (footerRef?.current) ro.observe(footerRef.current);
    if (topRef.current) ro.observe(topRef.current);
    return () => {
      window.removeEventListener('resize', compute);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [topRef, footerRef, spacerRef, rowHeight, rowGap, grid, bottomGap, min, max, footerFallback]);

  return count;
}

/**
 * Keeps a list's footer (count, page size, pages) `bottomGap` above the bottom of the window when
 * the list is shorter than the window, by growing `spacerRef` above it. The space a fitted page
 * cannot fill with a whole row then sits between the rows and the footer, not under the footer.
 */
export function usePinnedFooter({
  footerRef,
  spacerRef,
  bottomGap,
}: {
  footerRef: RefObject<HTMLElement | null>;
  spacerRef: RefObject<HTMLElement | null>;
  bottomGap: number;
}) {
  useEffect(() => {
    let raf = 0;
    const pin = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const foot = footerRef.current;
        const spacer = spacerRef.current;
        if (!foot || !spacer || foot.offsetParent === null) return;
        const current = spacer.offsetHeight;
        const footBottom = foot.getBoundingClientRect().bottom + window.scrollY;
        const want = Math.max(0, Math.floor(current + window.innerHeight - bottomGap - footBottom));
        if (want !== current) spacer.style.height = `${want}px`;
      });
    };
    pin();
    window.addEventListener('resize', pin);
    const ro = new ResizeObserver(pin);
    const parent = spacerRef.current?.parentElement;
    if (parent) ro.observe(parent);
    return () => {
      window.removeEventListener('resize', pin);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [footerRef, spacerRef, bottomGap]);
}
