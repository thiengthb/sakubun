// Visual tiers for the study-day streak flame + milestone celebration (Cụm C). The flame gets HOTTER
// as the streak grows — its heat encodes the streak length (a data viz, not a decorative icon), which
// is why the streak uses a gradient SVG flame rather than the flat lucide icon. Pure data; the flame
// component (components/streak-flame.tsx) and the celebration (components/streak-celebration.tsx) read
// from here so the ramp stays in one place.

export interface StreakTier {
  /** Minimum streak (inclusive) that reaches this tier. */
  min: number;
  /** Short Vietnamese label ("Nhen" → "Trắng nóng"). */
  name: string;
  /** Flame gradient stops top→base + optional hot core. */
  top: string;
  mid: string;
  base: string;
  core: string;
  coreOp: number;
  /** Glow radius (drop-shadow) for the inline flame. */
  glow: string;
  /** Flicker animation duration — faster = more agitated. */
  flick: string;
  /** Opacity of the card-wide heat wash (0–1). */
  heat: number;
  /** Hero flame size (px) in the celebration. */
  hero: number;
  /** Two accent colours used for glow + embers. */
  f1: string;
  f2: string;
}

export const STREAK_TIERS: StreakTier[] = [
  {
    min: 1,
    name: 'Nhen',
    top: '#fcd34d',
    mid: '#f59e0b',
    base: '#b45309',
    core: '#ffffff',
    coreOp: 0,
    glow: '2px',
    flick: '2.6s',
    heat: 0.06,
    hero: 96,
    f1: '#f59e0b',
    f2: '#f97316',
  },
  {
    min: 3,
    name: 'Bén',
    top: '#fde68a',
    mid: '#f97316',
    base: '#c2410c',
    core: '#fff7ed',
    coreOp: 0.15,
    glow: '4px',
    flick: '2.2s',
    heat: 0.1,
    hero: 104,
    f1: '#f97316',
    f2: '#fb923c',
  },
  {
    min: 7,
    name: 'Nóng',
    top: '#fef3c7',
    mid: '#fb923c',
    base: '#ea580c',
    core: '#fffbeb',
    coreOp: 0.3,
    glow: '7px',
    flick: '1.9s',
    heat: 0.16,
    hero: 116,
    f1: '#f97316',
    f2: '#fbbf24',
  },
  {
    min: 14,
    name: 'Rực',
    top: '#fff7ed',
    mid: '#f97316',
    base: '#dc2626',
    core: '#fef08a',
    coreOp: 0.45,
    glow: '10px',
    flick: '1.6s',
    heat: 0.22,
    hero: 126,
    f1: '#ef4444',
    f2: '#f97316',
  },
  {
    min: 30,
    name: 'Cháy dữ',
    top: '#ffffff',
    mid: '#fb923c',
    base: '#dc2626',
    core: '#fde68a',
    coreOp: 0.6,
    glow: '14px',
    flick: '1.35s',
    heat: 0.3,
    hero: 140,
    f1: '#ef4444',
    f2: '#fb923c',
  },
  {
    min: 100,
    name: 'Trắng nóng',
    top: '#ffffff',
    mid: '#fde68a',
    base: '#f97316',
    core: '#bfdbfe',
    coreOp: 0.7,
    glow: '20px',
    flick: '1.1s',
    heat: 0.4,
    hero: 156,
    f1: '#fb923c',
    f2: '#fef3c7',
  },
];

/**
 * The "cold" gradient — a streak of 0. Not a tier (it encodes the ABSENCE of heat), so it sits
 * beside the ramp rather than in it.
 *
 * Consolidated here 2026-07-29: these three greys, and FLAME_WHITE below, were the only flame
 * colours still written inline in the components, which is exactly what this module's header says
 * must not happen ("the ramp stays in one place"). Values are unchanged — this moves them, it does
 * not restyle anything.
 *
 * These are deliberately theme-INDEPENDENT: the flame's colour encodes the streak length, so it is
 * data, not chrome, and it must read the same in light and dark.
 */
export const COLD_FLAME = { top: '#9ca3af', mid: '#6b7280', base: '#4b5563' } as const;

/** The hot white at the centre of an ember and on the celebration count — the top of the ramp. */
export const FLAME_WHITE = '#fff7ed';

/** The dark scrim under the celebration flame. Theme-independent for the same reason. */
export const CELEBRATION_VIGNETTE = 'rgba(0,0,0,.42)';

/** The tier a streak count falls into (defaults to the first tier; callers treat count < 1 as "cold"). */
export function tierForStreak(count: number): StreakTier {
  let tier = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) if (count >= t.min) tier = t;
  return tier;
}
// STREAK_MILESTONES / milestoneFor removed 2026-07-24: the celebration no longer shows a milestone
// banner ("mốc") or caption — just the flame + day count (per request). The flame's tier heat stays.
