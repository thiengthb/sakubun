'use client';

import { useEffect, useState } from 'react';
import { getStreakAction } from '@/app/actions';
import { StreakCelebration } from '@/components/features/dashboard/streak-celebration';

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
