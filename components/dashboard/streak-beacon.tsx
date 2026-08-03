'use client';

import { useEffect, useState } from 'react';
import { getStreakAction } from '@/app/actions';
import { StreakCelebration } from '@/components/dashboard/streak-celebration';

/**
 * App-wide streak beacon: polls the current study-day streak (a cheap count) and mounts the celebration
 * so the fire fires on WHATEVER page the user is on when the streak ticks up — Claude grades a review out
 * of band (MCP), the streak grows, and this catches it without needing the dashboard open. The
 * once-per-increase guard lives in StreakCelebration (localStorage baseline), so this only supplies the
 * value. Polls on mount, on focus / tab-visible, and on a slow interval while the tab is visible (paused
 * when hidden — no background work). Mounted once in the app shell.
 */
export function StreakBeacon({ intervalMs = 45_000 }: { intervalMs?: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      getStreakAction().then((r) => {
        if (alive && r.ok) setCurrent(r.data.current);
      });
    };
    load();
    const id = setInterval(load, intervalMs);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [intervalMs]);

  return <StreakCelebration current={current} />;
}
