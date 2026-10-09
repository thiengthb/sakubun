import { describe, expect, it } from 'vitest';
import type { Confusion } from '@/lib/session/error-tags';
import {
  HALF_LIFE_DAYS,
  MAX_EVIDENCE,
  MIN_OCCURRENCES,
  minePairs,
  type ConfusionRow,
} from '@/lib/library/mining';

const NOW = new Date('2026-07-27T10:00:00Z');
const DAY = 86_400_000;

function row(
  daysAgo: number,
  confusions: Confusion[],
  over: Partial<ConfusionRow> = {},
): ConfusionRow {
  return {
    itemId: 'it-dokoroka',
    expression: '〜どころか',
    sentenceId: `s-${daysAgo}`,
    reviewedAt: new Date(NOW.getTime() - daysAgo * DAY),
    confusions,
    ...over,
  };
}

const PAIR: Confusion = { tag: 'word-choice', used: 'ほかに', required: '〜どころか' };

describe('minePairs — a slip is not a pattern', () => {
  it('stays silent below the occurrence threshold', () => {
    const rows = Array.from({ length: MIN_OCCURRENCES - 1 }, (_, i) => row(i, [PAIR]));
    expect(minePairs(rows, NOW)).toEqual([]);
  });

  it('emits once the same confusion recurs, with the count and the evidence', () => {
    const rows = Array.from({ length: MIN_OCCURRENCES }, (_, i) => row(i, [PAIR]));
    const [pair] = minePairs(rows, NOW);
    expect(pair.used).toBe('ほかに');
    expect(pair.required).toBe('〜どころか');
    expect(pair.count).toBe(MIN_OCCURRENCES);
    expect(pair.tag).toBe('word-choice');
    expect(pair.itemIds).toEqual(['it-dokoroka']);
    expect(pair.evidence.length).toBeGreaterThan(0);
  });

  it('caps the evidence — it is a sample to re-read, not an archive', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(i, [PAIR]));
    expect(minePairs(rows, NOW)[0].evidence).toHaveLength(MAX_EVIDENCE);
  });
});

describe('minePairs — old difficulties stop being current', () => {
  it('drops a pair whose occurrences have all decayed away', () => {
    const old = Array.from({ length: MIN_OCCURRENCES }, (_, i) =>
      row(HALF_LIFE_DAYS * 4 + i, [PAIR]),
    );
    expect(minePairs(old, NOW)).toEqual([]);

    const fresh = Array.from({ length: MIN_OCCURRENCES }, (_, i) => row(i, [PAIR]));
    expect(minePairs(fresh, NOW)).toHaveLength(1);
  });

  it('ranks the more recent difficulty first even when the counts tie', () => {
    const other: Confusion = { used: 'に', required: 'で' };
    const rows = [
      ...Array.from({ length: 4 }, (_, i) => row(HALF_LIFE_DAYS + i, [PAIR])),
      ...Array.from({ length: 4 }, (_, i) => row(i, [other])),
    ];
    const mined = minePairs(rows, NOW);
    expect(mined.map((m) => m.used)).toEqual(['に', 'ほかに']);
  });
});

describe('minePairs — the key is the same one "do I already have this" uses', () => {
  it('collapses tilde/quote spellings of the same pattern into ONE difficulty', () => {
    const rows = [
      row(0, [{ used: 'ほかに', required: '〜どころか' }]),
      row(1, [{ used: '「ほかに」', required: 'どころか' }]),
      row(2, [{ used: 'ほかに', required: '～どころか' }]),
    ];
    expect(minePairs(rows, NOW)).toHaveLength(1);
  });

  it('shows the NEWEST spelling, not the first one seen', () => {
    const rows = [
      row(5, [{ used: 'ほかに', required: 'どころか' }]),
      row(4, [{ used: 'ほかに', required: 'どころか' }]),
      row(0, [{ used: 'ほかに', required: '〜どころか' }]),
    ];
    expect(minePairs(rows, NOW)[0].required).toBe('〜どころか');
  });
});

describe('minePairs — never attach a contrast to the wrong card', () => {
  it('links only the item that IS the required side', () => {
    const rows = Array.from({ length: MIN_OCCURRENCES }, (_, i) =>
      row(i, [PAIR], { itemId: 'it-bakarini', expression: '〜ばかりに' }),
    );
    expect(minePairs(rows, NOW)[0].itemIds).toEqual([]);
  });

  it('ignores a "confusion" of a pattern with itself', () => {
    const rows = Array.from({ length: MIN_OCCURRENCES }, (_, i) =>
      row(i, [{ used: '「〜どころか」', required: '〜どころか' }]),
    );
    expect(minePairs(rows, NOW)).toEqual([]);
  });

  it('a row with no detail contributes nothing (every pre-2026-07-27 row)', () => {
    expect(minePairs([row(0, []), row(1, []), row(2, [])], NOW)).toEqual([]);
  });
});
