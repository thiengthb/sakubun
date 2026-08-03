// Shared SRS/FSRS-state vocabulary for the resource tables (grammar + vocab) and the item detail/analytics
// views — one source so the state labels + the state/star/share filter option lists never drift between the
// twin tables (they were byte-identical copies in items-table.tsx + vocab-table.tsx + item-analytics.tsx +
// item-detail-dialog.tsx). Domain-specific option lists (CARD_FILTERS for grammar, REASON_FILTERS for vocab)
// stay in their own table — they are NOT shared.

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

/** Library share status (visibility). */
export const SHARE_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'public', label: 'Đang chia sẻ' },
  { value: 'private', label: 'Chưa chia sẻ' },
] as const;
