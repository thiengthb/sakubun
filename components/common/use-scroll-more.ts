'use client';

import { useEffect, useRef, useState } from 'react';

// Card lists (docs/ui-standard.md › Bố cục) show this many more each time their end scrolls into
// view; only tables page.
export const SCROLL_STEP = 20;

/**
 * The first `shown` of `all`, growing by SCROLL_STEP whenever the sentinel nears the viewport. The
 * list starts over whenever `listKey` changes: a new search, sort or filter.
 */
export function useScrollMore<T>(all: readonly T[], listKey: string) {
  const [more, setMore] = useState({ key: listKey, shown: SCROLL_STEP });
  const shown = more.key === listKey ? more.shown : SCROLL_STEP;
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
          shown: (m.key === listKey ? m.shown : SCROLL_STEP) + SCROLL_STEP,
        }));
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, listKey]);
  return { items: all.slice(0, shown), hasMore, sentinelRef };
}
