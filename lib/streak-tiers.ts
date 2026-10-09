export interface StreakTier {
  min: number;
  name: string;
  top: string;
  mid: string;
  base: string;
  core: string;
  coreOp: number;
  glow: string;
  flick: string;
  heat: number;
  hero: number;
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

export const COLD_FLAME = { top: '#9ca3af', mid: '#6b7280', base: '#4b5563' } as const;

export const FLAME_WHITE = '#fff7ed';

export const CELEBRATION_VIGNETTE = 'rgba(0,0,0,.42)';

export function tierForStreak(count: number): StreakTier {
  let tier = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) if (count >= t.min) tier = t;
  return tier;
}
