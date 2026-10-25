export type WeakReason = 'misses' | 'lapses' | 'hard';

export interface WeakRow {
  key: string;
  text: string;
  href?: string;
  misses?: number;
  lapses?: number;
  hard?: number;
}

/**
 * Merges the per-reason weak lists into one row per pattern, for the phone table. A forgotten
 * pattern weighs twice a missed one; difficulty only breaks ties, since every studied pattern
 * has one.
 */
export function mergeWeakRows(
  lists: {
    reason: WeakReason;
    entries: { key: string; text: string; href?: string; n: number }[];
  }[],
): WeakRow[] {
  const rows = new Map<string, WeakRow>();
  for (const { reason, entries } of lists) {
    for (const e of entries) {
      const row = rows.get(e.key) ?? { key: e.key, text: e.text, href: e.href };
      row[reason] = e.n;
      rows.set(e.key, row);
    }
  }
  const weight = (r: WeakRow) => (r.misses ?? 0) + 2 * (r.lapses ?? 0);
  return [...rows.values()].sort((a, b) => weight(b) - weight(a) || (b.hard ?? 0) - (a.hard ?? 0));
}
