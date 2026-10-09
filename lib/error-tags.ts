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

export interface Confusion {
  tag?: ErrorTag;
  used: string;
  required: string;
}

export const MAX_CONFUSIONS = 3;

export const confusionSchema = z.object({
  tag: z.enum(ERROR_TAGS).optional(),
  used: z.string().min(1).max(60),
  required: z.string().min(1).max(60),
});

export const errorDetailSchema = z.array(confusionSchema).max(MAX_CONFUSIONS);

export function parseErrorDetail(raw: string | null | undefined): Confusion[] {
  if (!raw) return [];
  try {
    const result = errorDetailSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

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
