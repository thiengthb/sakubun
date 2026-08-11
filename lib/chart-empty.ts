/**
 * Câu thay cho một biểu đồ không có gì để vẽ — hoặc `null` nếu có dữ liệu.
 *
 * Vì sao là hàm thuần ở `lib/` chứ không phải mấy dòng ternary trong component: đây là một QUYẾT ĐỊNH
 * HIỂN THỊ, và `vitest.config.ts` chỉ include `lib/**`, nên nằm ở đây thì nó test được mà không cần
 * trình duyệt. Cùng khuôn với `lib/score-label.ts`, và cùng một luật: **ô trống không phải trạng thái
 * hiển thị hợp lệ**. Một `ComposedChart` nhận chuỗi toàn số 0 vẫn vẽ đủ lưới và hai trục trên 240px, nên
 * người học đọc nó thành biểu đồ HỎNG chứ không phải "chưa có dữ liệu" — sáu thẻ như thế chiếm gần hết
 * 2683px chiều cao trang chủ đo ở 390px (2026-08-11).
 *
 * Hai ca được phân biệt vì việc cần làm khác nhau:
 *   - cửa sổ đang chọn rỗng mà cả năm CÓ dữ liệu → nói cách xem: chọn kỳ dài hơn, dữ liệu vẫn còn đó
 *   - chưa từng có gì → nói dữ liệu ĐẾN TỪ ĐÂU, vì không nút nào trên web sinh ra nó (app không chấm;
 *     mọi lượt luyện đi qua Claude Desktop)
 */
export function chartEmptyMessage({
  hasInWindow,
  hasInYear,
  rangeLabel,
  noun,
}: {
  /** Cửa sổ đang chọn có gì để vẽ không. */
  hasInWindow: boolean;
  /** Cả chuỗi 365 ngày có gì không. */
  hasInYear: boolean;
  /** Nhãn kỳ đang chọn, đúng chữ trên ô chọn ("30 ngày" · "1 năm"). */
  rangeLabel: string;
  /** Danh từ của thứ đang thiếu, đã ở dạng ghép được câu ("lượt ôn nào", "hoạt động nào"). */
  noun: string;
}): string | null {
  if (hasInWindow) return null;
  return hasInYear
    ? `Chưa có ${noun} trong ${rangeLabel} gần nhất — chọn kỳ dài hơn để xem.`
    : `Chưa có ${noun}. Luyện với Claude rồi quay lại đây.`;
}
