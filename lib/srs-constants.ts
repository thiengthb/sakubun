// Shared SRS/FSRS-state vocabulary for the resource tables (grammar + vocab) and the item detail/analytics
// views — one source so the state labels + the state/star/share filter option lists never drift between the
// twin tables (they were byte-identical copies in items-table.tsx + vocab-table.tsx + item-analytics.tsx +
// item-detail-dialog.tsx). Domain-specific option lists (CARD_FILTERS for grammar, REASON_FILTERS for vocab)
// stay in their own table — they are NOT shared.

import { JLPT_LEVELS } from '@/lib/settings-schema';

/** FSRS state code → Vietnamese label. */
export const STATE_LABELS: Record<number, string> = {
  0: 'Mới',
  1: 'Đang học',
  2: 'Ôn tập',
  3: 'Học lại',
};

/** Filter value → SRS state code (or the special "suspended" bucket). */
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

/**
 * Cấp JLPT dưới dạng danh sách option, kèm mục "Mọi cấp".
 *
 * Có mặt ở đây vì `JLPT_LEVELS` (lib/settings-schema) là mảng chuỗi trần, nên mỗi bảng phải tự dựng
 * `{value,label}` và tự thêm mục "all" — ba chỗ đã làm đúng việc đó ba lần. Một danh sách, một chỗ.
 */
export const JLPT_FILTERS = [
  { value: 'all', label: 'Mọi cấp' },
  ...JLPT_LEVELS.map((l) => ({ value: l, label: l })),
] as const;

/** Library share status (visibility). */
export const SHARE_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'public', label: 'Đang chia sẻ' },
  { value: 'private', label: 'Chưa chia sẻ' },
] as const;
