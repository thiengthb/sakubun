'use client';

import { useId, type CSSProperties } from 'react';
import { COLD_FLAME, tierForStreak } from '@/lib/streak-tiers';
import { cn } from '@/lib/utils';

// The outer flame tongue + a small hot core, shared by the inline flame and the celebration hero. The
// INNER flame reuses the outer path, shrunk from the same base, for a layered "flame within a flame"
// look — brighter toward the core, so the mark reads as real fire instead of a flat glyph.
const FLAME_PATH =
  'M12 2c.6 3.2 2.5 4.6 3.9 6.2 1.3 1.5 2.6 3.2 2.6 5.6a6.5 6.5 0 1 1-13 0c0-1.4.5-2.6 1.3-3.3.2 1 .9 1.8 1.9 1.8 1.2 0 1.7-.9 1.7-2.2C10.3 8 9.7 5 12 2Z';
const CORE_PATH =
  'M12 12.3c.9 1 1.6 1.9 1.6 3.2A2.6 2.6 0 0 1 9 17.2c0-1 .5-1.8 1.2-2.6.1.6.5 1 1 1 .6 0 .9-.5.9-1.1 0-.9-.4-1.4-.1-2.2Z';
// Shrink the inner flame from the shared base (12,22) so both tongues rise from the same root.
const INNER_TRANSFORM = 'translate(12 22) scale(0.6) translate(-12 -22)';

/**
 * The study-streak flame: a LAYERED gradient SVG (outer tongue + brighter inner tongue + a pulsing hot
 * core) whose colour, glow and flicker intensify with the streak length (heat = streak = data, so this
 * is a data-viz mark, not a decorative icon). `count < 1` renders a muted, still "cold" flame. Used
 * inline (streak card, sidebar) and, at a large size, as the celebration hero. Size comes from the
 * caller via `className` (defaults to 1em). All animation touches only transform/opacity/filter, so the
 * global reduced-motion rule can neutralise it.
 */
export function StreakFlame({
  count,
  className,
  hero = false,
  sizePx,
}: {
  count: number;
  className?: string;
  /** Hero (celebration) styling: bigger glow + a rise-in animation instead of the inline flicker. */
  hero?: boolean;
  /** Explicit pixel size (overrides the 1em default) — used for the large celebration flame. */
  sizePx?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const outer = `o${uid}`;
  const inner = `i${uid}`;
  const cold = count < 1;
  const t = tierForStreak(count);
  const vars = {
    ...(cold ? {} : { '--flame2': t.f2, '--glow': t.glow, '--flick': t.flick }),
    ...(sizePx ? { width: sizePx, height: sizePx } : {}),
  } as CSSProperties;

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={vars}
      className={cn(
        'size-[1em]',
        cold ? 'streak-flame--cold' : hero ? 'streak-hero' : 'streak-flame',
        className,
      )}
    >
      <defs>
        <linearGradient id={outer} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={cold ? COLD_FLAME.top : t.top} />
          <stop offset="0.55" stopColor={cold ? COLD_FLAME.mid : t.mid} />
          <stop offset="1" stopColor={cold ? COLD_FLAME.base : t.base} />
        </linearGradient>
        <linearGradient id={inner} x1="12" y1="8" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={t.core} />
          <stop offset="0.6" stopColor={t.top} />
          <stop offset="1" stopColor={t.mid} />
        </linearGradient>
      </defs>
      <path fill={`url(#${outer})`} d={FLAME_PATH} />
      {!cold && (
        <path
          className="streak-flame-inner"
          fill={`url(#${inner})`}
          transform={INNER_TRANSFORM}
          d={FLAME_PATH}
        />
      )}
      {!cold && t.coreOp > 0 && <path fill={t.core} opacity={t.coreOp} d={CORE_PATH} />}
    </svg>
  );
}
