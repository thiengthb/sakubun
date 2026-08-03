// Fixed error taxonomy — Claude tags each miss when grading (rating ≤ 2) so weaknesses aggregate
// across sessions (explicit metalinguistic feedback + analytics; Li 2010). Free text can't be
// counted; a closed set can.

import { z } from 'zod';

export const ERROR_TAGS = [
  'particle', // trợ từ (は/が/に/で…)
  'conjugation', // chia động từ / tính từ (thể, thì, phủ định)
  'word-choice', // chọn sai từ / dùng từ gần nghĩa sai chỗ
  'word-order', // trật tự từ, cấu trúc câu
  'register', // sai văn phong (thường thể vs kính ngữ…)
  'comprehension', // hiểu sai nghĩa câu gốc (JA→VI)
  'kana-spelling', // viết sai kana / kanji / chính tả
  'omission', // bỏ sót ý / thiếu thành phần
] as const;

export type ErrorTag = (typeof ERROR_TAGS)[number];

export const ERROR_TAG_LABELS: Record<ErrorTag, string> = {
  particle: 'Trợ từ',
  conjugation: 'Chia động từ',
  'word-choice': 'Chọn từ',
  'word-order': 'Trật tự từ',
  register: 'Văn phong',
  comprehension: 'Hiểu nghĩa',
  'kana-spelling': 'Chính tả/kana',
  omission: 'Bỏ sót ý',
};

/**
 * ONE confusion, recorded alongside the flat tag: what the learner reached for, and what the sentence
 * actually needed.
 *
 * Why the tag alone was not enough (observed in the lab, 2026-07-26): a deliberate ほかに-for-〜どころか
 * substitution was stored as `word-choice`. Next session the tutor knows "he has a word-choice problem"
 * — not "he substitutes ほかに for 〜どころか", which is the only version of that fact you can teach
 * against. The error-tagged-learner-corpus literature says the same thing: a corpus becomes useful when
 * the annotation is fine-grained enough to point at an ATTESTED difficulty.
 *
 * Deliberately free text on both sides. `required` is usually a library item and `used` usually is not
 * (that is the whole point — the learner reached OUTSIDE the pattern being drilled), so forcing itemIds
 * would silently discard the interesting half.
 */
export interface Confusion {
  /** Which tag this pair explains, when the review carried more than one. */
  tag?: ErrorTag;
  /** What the learner actually wrote. */
  used: string;
  /** What the sentence required instead. */
  required: string;
}

/** At most this many pairs per review — a grading turn that finds more is describing a rewrite. */
export const MAX_CONFUSIONS = 3;

export const confusionSchema = z.object({
  tag: z.enum(ERROR_TAGS).optional(),
  used: z.string().min(1).max(60),
  required: z.string().min(1).max(60),
});

export const errorDetailSchema = z.array(confusionSchema).max(MAX_CONFUSIONS);

/** Tolerant read: every row written before 2026-07-27 has none, and a reader must treat that as empty. */
export function parseErrorDetail(raw: string | null | undefined): Confusion[] {
  if (!raw) return [];
  try {
    const result = errorDetailSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

/** null (not "[]") when there is nothing to store, so an empty detail stays indistinguishable from an old row. */
export function serializeErrorDetail(list: Confusion[] | undefined): string | null {
  if (!list || list.length === 0) return null;
  const parsed = errorDetailSchema.safeParse(list);
  return parsed.success && parsed.data.length > 0 ? JSON.stringify(parsed.data) : null;
}

export function parseErrorTags(raw: string | null | undefined): ErrorTag[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is ErrorTag => (ERROR_TAGS as readonly string[]).includes(t));
  } catch {
    return [];
  }
}
