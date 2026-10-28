'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A card list too big to send at once (Kho chung's Từng mục, 7.4i): the server's first page, then
 * the next ones from `load` whenever the sentinel nears the viewport, until `total`. A new
 * `listKey` (search, filter, sort) starts over from `first`; a refresh of `first` under the same key
 * keeps what was loaded after it.
 */
export function useServerScrollMore<T>(
  first: readonly T[],
  total: number,
  listKey: string,
  load: (skip: number) => Promise<T[]>,
) {
  const [state, setState] = useState<{ key: string; more: T[]; end: boolean }>({
    key: listKey,
    more: [],
    end: false,
  });
  const mine = state.key === listKey;
  const rows = [...first, ...(mine ? state.more : [])];
  // An empty page ends the list even short of `total` (entries hidden since the count).
  const hasMore = !(mine && state.end) && rows.length < total;
  const [busy, setBusy] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const skip = rows.length;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || busy) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setBusy(true);
        load(skip)
          .then((next) =>
            setState((s) => ({
              key: listKey,
              more: [...(s.key === listKey ? s.more : []), ...next],
              end: next.length === 0,
            })),
          )
          .finally(() => setBusy(false));
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, busy, listKey, skip, load]);

  return { rows, hasMore, sentinelRef };
}
