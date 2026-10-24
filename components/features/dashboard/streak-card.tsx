'use client';

import { useState, type ReactNode } from 'react';
import { StatTile } from '@/components/features/dashboard/dashboard-charts';
import { StreakCelebration } from '@/components/features/dashboard/streak-celebration';
import { StreakFlame } from '@/components/features/dashboard/streak-flame';
import { tierForStreak } from '@/lib/srs/streak-tiers';

// The streak stat tile: the flame stands where the other tiles have their icon, and pressing it
// replays the celebration.
export function StreakCard({ current, explain }: { current: number; explain?: ReactNode }) {
  const t = tierForStreak(current);
  const [preview, setPreview] = useState(0);
  return (
    <div className="relative">
      <StatTile
        media={
          <button
            type="button"
            onClick={() => setPreview((p) => p + 1)}
            aria-label="Xem lại hiệu ứng chuỗi ngày"
            className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-warn-wash transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {current > 0 && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-lg"
                style={{
                  opacity: t.heat,
                  background: `radial-gradient(closest-side, ${t.f2}, transparent)`,
                }}
              />
            )}
            <StreakFlame count={current} className="relative size-4" />
          </button>
        }
        items={[{ value: current, label: 'Chuỗi ngày' }]}
        explain={explain}
      />
      <StreakCelebration current={current} previewNonce={preview} auto={false} />
    </div>
  );
}
