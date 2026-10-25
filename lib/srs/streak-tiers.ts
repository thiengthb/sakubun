export interface StreakTier {
  min: number;
  name: string;
  hero: number;
  f1: string;
  f2: string;
}

export const STREAK_TIERS: StreakTier[] = [
  {
    min: 1,
    name: 'Nhen',
    hero: 96,
    f1: '#f59e0b',
    f2: '#f97316',
  },
  {
    min: 3,
    name: 'Bén',
    hero: 104,
    f1: '#f97316',
    f2: '#fb923c',
  },
  {
    min: 7,
    name: 'Nóng',
    hero: 116,
    f1: '#f97316',
    f2: '#fbbf24',
  },
  {
    min: 14,
    name: 'Rực',
    hero: 126,
    f1: '#ef4444',
    f2: '#f97316',
  },
  {
    min: 30,
    name: 'Cháy dữ',
    hero: 140,
    f1: '#ef4444',
    f2: '#fb923c',
  },
  {
    min: 100,
    name: 'Trắng nóng',
    hero: 156,
    f1: '#fb923c',
    f2: '#fef3c7',
  },
];

export const FLAME_WHITE = '#fff7ed';

/** The streak icon: Duolingo's flat orange and yellow, and its grey for no streak. */
export const DUO_FLAME = {
  lit: { body: '#ff9600', core: '#ffc800' },
  cold: { body: '#d4d4d4', core: '#ececec' },
} as const;

export const CELEBRATION_VIGNETTE = 'rgba(0,0,0,.42)';

export function tierForStreak(count: number): StreakTier {
  let tier = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) if (count >= t.min) tier = t;
  return tier;
}
