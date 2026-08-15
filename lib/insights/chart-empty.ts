export function chartEmptyMessage({
  hasInWindow,
  hasInYear,
  rangeLabel,
  noun,
}: {
  hasInWindow: boolean;
  hasInYear: boolean;
  rangeLabel: string;
  noun: string;
}): string | null {
  if (hasInWindow) return null;
  return hasInYear
    ? `Chưa có ${noun} trong ${rangeLabel} gần nhất — chọn kỳ dài hơn để xem.`
    : `Chưa có ${noun}. Luyện với Claude rồi quay lại đây.`;
}
