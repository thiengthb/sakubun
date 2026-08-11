/**
 * NHÃN ĐIỂM của một lượt — một chỗ duy nhất quyết định thẻ hiện gì ở ô điểm.
 *
 * Vì sao là một hàm riêng, không phải hai nhánh JSX (2026-08-11): người học báo "vẫn chưa hiện điểm
 * trên UI" và đo được đúng nguyên nhân — thẻ chỉ render con số khi `typeof score === 'number'`, nên một
 * lượt đã GRADED mà không có điểm biến thành một Ô TRỐNG không giải thích được. Người học đọc ô trống
 * đó là "app không chấm", và không có cách nào phân biệt nó với lỗi thật.
 *
 * Ô trống là một quyết định hiển thị, nên nó phải test được mà không cần trình duyệt. Hàm thuần này ở
 * `lib/` (nơi vitest nhìn thấy — `vitest.config.ts` chỉ include `lib/**`), còn màu sắc vẫn do
 * `scoreClass()` ở tầng component lo.
 *
 * Điểm null CHỈ còn xảy ra với hàng cũ: từ 2026-08-11 `submit_review` bắt buộc có `score`
 * (`lib/mcp/tools/practice.ts`), nên lượt mới không thể thiếu điểm nữa.
 */

export type SentenceDisplayStatus = 'PENDING' | 'GRADED' | 'SKIPPED';

export type ScoreLabel = {
  text: string;
  /** true = chữ mờ (trạng thái, không phải thành tích) → component không tô màu theo thang điểm. */
  muted: boolean;
};

export function scoreLabel(status: string, score: number | null | undefined): ScoreLabel | null {
  if (status === 'SKIPPED') return { text: 'Bỏ qua', muted: true };
  // PENDING có thẻ riêng (PendingCard) nói "đang chờ trả lời" — ô điểm không thuộc về nó.
  if (status !== 'GRADED') return null;
  if (typeof score === 'number') return { text: `${score}/100`, muted: false };
  return { text: 'Chưa có điểm', muted: true };
}
