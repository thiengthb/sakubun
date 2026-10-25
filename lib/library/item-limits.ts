import { textLength } from '@/lib/library/group-limits';

// thien, 2026-10-25 (item detail rounds 1 and 2): a vocab word or grammar pattern is a word or a
// pattern, not a sentence, and its meaning is a gloss, not an explanation. The numbers:
// - expression 20: the longest real N1 patterns ("〜ないではいられない", "〜にもかかわらず") are
//   9 to 11 characters; 20 leaves room for a variant mark and keeps the 24px phone title to at
//   most two lines on a 390px phone (about 14 kana a line).
// - meaning 60: two lines of the header's 16px meaning on that phone (about 34 a line at 358px,
//   with Vietnamese tone marks); anything longer belongs in the tutor card's usage.
// - reading 30: kana run longer than the word they read (気配り is read きくばり); 30 covers a
//   20-character expression written all in kanji.
// - Hán Việt 30: one syllable per kanji, about 4 characters each with the space.
// Old items longer than this are kept as they are: only a value that is set or changed is checked.
// Pure: no Prisma, no I/O.
export const ITEM_LIMITS = {
  expression: 20,
  meaningVi: 60,
  reading: 30,
  hanviet: 30,
} as const;

export type LimitedField = keyof typeof ITEM_LIMITS;

const LABELS: Record<LimitedField, string> = {
  expression: 'Từ / mẫu',
  meaningVi: 'Nghĩa',
  reading: 'Cách đọc',
  hanviet: 'Âm Hán Việt',
};

/** A short error naming the fix, or null when the text fits. */
export function itemTextError(field: LimitedField, s: string | null | undefined): string | null {
  if (!s) return null;
  const max = ITEM_LIMITS[field];
  const n = textLength(s.trim());
  if (n <= max) return null;
  return `${LABELS[field]} tối đa ${max} ký tự, đang có ${n}. Phần giải thích dài để ở thẻ chi tiết.`;
}

type ItemText = Partial<Record<LimitedField, string | null | undefined>>;

/**
 * The first field that breaks a limit, with its error. With `before` (an edit), a field left as it
 * was is not checked, so an old long item can still be edited elsewhere.
 */
export function itemLimitError(
  next: ItemText,
  before?: ItemText,
): { field: LimitedField; message: string } | null {
  for (const field of Object.keys(ITEM_LIMITS) as LimitedField[]) {
    const value = next[field];
    if (value === undefined) continue;
    if (before && (value ?? '').trim() === (before[field] ?? '').trim()) continue;
    const message = itemTextError(field, value);
    if (message) return { field, message };
  }
  return null;
}

/** Hán Việt is always upper case (thien, 2026-10-25), stored that way. */
export function normalizeHanviet(s: string | null): string | null {
  return s ? s.toLocaleUpperCase('vi') : s;
}
