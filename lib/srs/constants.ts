import { JLPT_LEVELS } from '@/lib/settings/schema';

export const STATE_LABELS: Record<number, string> = {
  0: 'Mới',
  1: 'Đang học',
  2: 'Ôn tập',
  3: 'Học lại',
};

export const STATE_FILTERS = [
  { value: 'all', label: 'Mọi trạng thái' },
  { value: '0', label: 'Mới' },
  { value: '1', label: 'Đang học' },
  { value: '2', label: 'Ôn tập' },
  { value: '3', label: 'Học lại' },
  { value: 'suspended', label: 'Tạm ngưng' },
] as const;

export const STAR_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'yes', label: 'Đã đánh dấu sao' },
] as const;

export const JLPT_FILTERS = [
  { value: 'all', label: 'Mọi cấp' },
  ...JLPT_LEVELS.map((l) => ({ value: l, label: l })),
] as const;
