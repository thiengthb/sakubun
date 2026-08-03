'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { useSessionState } from '@/components/shared/use-session-state';
import { isGuideRecipeId, isGuideTabId } from '@/components/guide/guide-topic-meta';

/**
 * Client wrapper so the server-rendered `/guide` page can PERSIST its active tab across navigation +
 * reload (same session). The page stays a Server Component; only the Tabs root becomes controlled here.
 * The TabsList/TabsContent children are RSC output passed through — Radix's Tabs context flows from
 * this client provider to those (client) consumers as usual.
 *
 * It also APPLIES THE DEEP LINK (2026-07-25) — what makes every contextual "Xem hướng dẫn" link in the
 * rest of the app land where it promises:
 *   - `?tab=<id>` must WIN over the stored tab. `useSessionState` reads sessionStorage first and only
 *     falls back to the URL, so without this a visitor who had already opened /guide in this browser tab
 *     would keep landing on their previous tab and the link would look broken.
 *   - `?recipe=<id>` scrolls that how-to recipe into view (anchors live in `app/guide/page.tsx`).
 * Runs once per mount (a ref, not state), so switching tabs by hand afterwards is never overridden.
 */
export function GuideTabs({ children }: { children: ReactNode }) {
  const [tab, setTab] = useSessionState('guide.tab', 'start', 'tab');

  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const params = new URLSearchParams(window.location.search);
    const target = params.get('tab');
    if (target && isGuideTabId(target) && target !== tab) setTab(target);
    const recipe = params.get('recipe');
    if (!recipe || !isGuideRecipeId(recipe)) return;
    // The tab switch above has to commit (and mount that tab's content) before the anchor exists.
    const timer = setTimeout(() => {
      document
        .getElementById(`guide-recipe-${recipe}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    return () => clearTimeout(timer);
  }, [tab, setTab]);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      {children}
    </Tabs>
  );
}
