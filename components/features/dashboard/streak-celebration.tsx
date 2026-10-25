'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { StreakFlame } from '@/components/features/dashboard/streak-flame';
import { CELEBRATION_VIGNETTE, FLAME_WHITE, tierForStreak } from '@/lib/srs/streak-tiers';

const KEY = 'sakubun.streak.lastSeen';
const HOLD_MS = 2600;

interface Ember {
  left: number;
  dx: number;
  dy: number;
  dur: string;
  delay: string;
  size: number;
}

function buildEmbers(count: number): Ember[] {
  const n = Math.min(46, 12 + Math.round(count / 2));
  return Array.from({ length: n }, () => ({
    left: Math.round(Math.random() * 40 - 20),
    dx: Math.round((Math.random() * 2 - 1) * (120 + count)),
    dy: -(160 + Math.round(Math.random() * 220) + count),
    dur: (1.1 + Math.random() * 1.3).toFixed(2),
    delay: (Math.random() * 0.5).toFixed(2),
    size: Number((5 + Math.random() * 7).toFixed(1)),
  }));
}

export function StreakCelebration({
  current,
  previewNonce = 0,
  auto = true,
}: {
  current: number;
  previewNonce?: number;
  auto?: boolean;
}) {
  const [party, setParty] = useState<{ count: number; embers: Ember[] } | null>(null);
  const firedPreviewRef = useRef(0);

  useEffect(() => {
    if (!auto || current <= 0) return;
    let last: number | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      last = raw == null ? null : Number(raw);
    } catch {
      last = null;
    }
    try {
      localStorage.setItem(KEY, String(current));
    } catch {}
    if (last == null || !Number.isFinite(last) || current <= last) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-shot celebration triggered by a localStorage baseline + a prop increase; it's a genuine side effect, not render-derivable state.
    setParty({ count: current, embers: buildEmbers(current) });
    const timer = setTimeout(() => setParty(null), HOLD_MS);
    return () => clearTimeout(timer);
  }, [current, auto]);

  useEffect(() => {
    if (previewNonce <= 0 || previewNonce === firedPreviewRef.current) return;
    firedPreviewRef.current = previewNonce;
    const count = Math.max(1, current);
    setParty({ count, embers: buildEmbers(count) });
    const timer = setTimeout(() => setParty(null), HOLD_MS);
    return () => clearTimeout(timer);
  }, [previewNonce, current]);

  const t = party ? tierForStreak(party.count) : null;

  return (
    <AnimatePresence>
      {party && t && (
        <motion.div
          key="streak-celebration"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-0 z-[60] grid place-items-center"
          role="status"
          aria-live="polite"
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(60% 60% at 50% 62%, color-mix(in oklab, ${t.f1} 22%, transparent), ${CELEBRATION_VIGNETTE} 100%)`,
            }}
          />
          <div className="relative grid justify-items-center gap-2.5 text-center">
            {party.embers.map((e, i) => (
              <span
                key={i}
                className="streak-ember absolute rounded-full"
                style={
                  {
                    left: `calc(50% + ${e.left}px)`,
                    bottom: '40%',
                    width: e.size,
                    height: e.size,
                    background: `radial-gradient(circle at 40% 35%, ${FLAME_WHITE}, ${t.f1} 55%, transparent 75%)`,
                    '--dx': `${e.dx}px`,
                    '--dy': `${e.dy}px`,
                    '--dur': `${e.dur}s`,
                    animationDelay: `${e.delay}s`,
                  } as CSSProperties
                }
              />
            ))}
            <span
              className="streak-ring absolute"
              style={{
                top: '46%',
                left: '50%',
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: `3px solid ${t.f2}`,
              }}
            />
            <StreakFlame count={party.count} hero sizePx={t.hero} />
            <div
              className="streak-count text-6xl font-extrabold tabular-nums"
              style={{ color: FLAME_WHITE, textShadow: `0 2px 26px ${t.f1}` }}
            >
              {party.count}
              {/* The overlay shows the number alone; screen readers still hear what it counts. */}
              <span className="sr-only"> ngày liên tiếp</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
