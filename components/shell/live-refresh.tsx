'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps a Server-Component page fresh when the DB is written OUT OF BAND — Claude runs an MCP tool
 * (submit_review, add_grammar, enrich_items…) and the browser has no way to know. Calls
 * `router.refresh()` (re-fetches server data WITHOUT remounting client components, so table filters /
 * open dialogs survive) when the tab regains focus and on a light interval while the tab is visible.
 * The poll pauses when the tab is hidden (no wasted work in the background). Mount once per page that
 * mirrors MCP-written data: analytics `/`, `/history`, `/resources`.
 */
export function LiveRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = setInterval(refreshIfVisible, intervalMs);
    // Refresh the moment the user comes back to the tab/window (the common "I switched to Claude,
    // it graded, now I'm back" case) — faster than waiting for the next poll tick.
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [router, intervalMs]);

  return null;
}
