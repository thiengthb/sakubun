'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { fitItemCount } from '@/lib/fit-rows';

export interface UseFitRowsOptions {
  topRef: RefObject<HTMLElement | null>;
  footerRef?: RefObject<HTMLElement | null>;
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
        if (topRect.height <= 0 || childCount === 0) return;

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
