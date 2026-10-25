'use client';

import { useState, type ReactNode } from 'react';
import { StatTile } from '@/components/features/dashboard/dashboard-charts';
import { StreakCelebration } from '@/components/features/dashboard/streak-celebration';
import { StreakFlame } from '@/components/features/dashboard/streak-flame';
import { cn } from '@/lib/core/utils';

// The streak stat tile: the flame stands where the other tiles have their icon, on a phone too,
// and pressing it pops the flame and replays the celebration.
export function StreakCard({
  current,
  explain,
  note,
}: {
  current: number;
  explain?: ReactNode;
  note?: ReactNode;
}) {
  const [preview, setPreview] = useState(0);
  return (
    <div className="relative h-full">
      <StatTile
        className="h-full"
        mediaOnPhone
        media={
          <button
            type="button"
            onClick={() => setPreview((p) => p + 1)}
            aria-label="Xem lại hiệu ứng chuỗi ngày"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warn-wash focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* Remounted on each press so the pop plays again; the flame's own sway runs inside it. */}
            <span key={preview} className={cn('flex', preview > 0 && 'streak-duo streak-duo--pop')}>
              <StreakFlame count={current} className="size-6" />
            </span>
          </button>
        }
        items={[{ value: current, label: 'Chuỗi ngày' }]}
        explain={explain}
        note={note}
      />
      <StreakCelebration current={current} previewNonce={preview} auto={false} />
    </div>
  );
}
