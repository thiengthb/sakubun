'use client';

import { useEffect, useRef, useState } from 'react';

// Card lists (docs/ui-standard.md › Bố cục) show this many more each time their end scrolls into
// view; only tables page.
export const SCROLL_STEP = 20;

/**
 * The first `shown` of `all`, growing by `step` (SCROLL_STEP for cards) whenever the sentinel nears
 * the viewport. The list starts over whenever `listKey` changes: a new search, sort or filter. A grid
 * of small tiles passes a larger step, so that one step reaches past the viewport.
 */
export function useScrollMore<T>(all: readonly T[], listKey: string, step: number = SCROLL_STEP) {
  const [more, setMore] = useState({ key: listKey, shown: step });
  const shown = more.key === listKey ? more.shown : step;
  const hasMore = shown < all.length;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setMore((m) => ({
          key: listKey,
          shown: (m.key === listKey ? m.shown : step) + step,
        }));
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, listKey, step]);
  return { items: all.slice(0, shown), hasMore, sentinelRef };
}
