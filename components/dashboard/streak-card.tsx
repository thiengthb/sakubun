'use client';

import { useState } from 'react';
import { StreakCelebration } from '@/components/dashboard/streak-celebration';
import { StreakFlame } from '@/components/dashboard/streak-flame';
import { tierForStreak } from '@/lib/streak-tiers';

/**
 * The dashboard "Chuỗi ngày học" stat card — same shape as the other StatCards but with the live streak
 * flame (heat scales with the streak), a faint heat wash behind it at higher tiers, and the once-per-
 * increase fire celebration mounted alongside. `current === 0` shows a cold, still flame.
 */
export function StreakCard({ current, hint }: { current: number; hint?: string }) {
  const t = tierForStreak(current);
  // Bumping this replays the fire celebration — lets the user (re)watch the effect on demand.
  const [preview, setPreview] = useState(0);
  return (
    // rounded-xl + bg-card to match the KPI tiles it shares a row with (issue #38): the page background
    // is ivory, so a transparent tile is a hairline rectangle rather than a card.
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card p-4">
      {current > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: t.heat,
            background: `radial-gradient(120px 90px at 22px 42px, ${t.f2}, transparent 70%)`,
          }}
        />
      )}
      <div className="relative">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => setPreview((p) => p + 1)}
            aria-label="Xem lại hiệu ứng chuỗi ngày"
            title="Bấm để xem hiệu ứng lửa"
            className="-m-1 rounded-md p-1 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <StreakFlame count={current} className="size-[18px]" />
          </button>
          Chuỗi ngày học
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{current} ngày</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
      {/* Preview-only here (click the flame to replay); the app-wide StreakBeacon owns the auto-fire. */}
      <StreakCelebration current={current} previewNonce={preview} auto={false} />
    </div>
  );
}
