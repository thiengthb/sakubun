/**
 * Cổng: mỗi luật phải trỏ `canonical` vào một chỗ CÓ THẬT.
 *
 * Vì sao đây là một cổng chứ không phải chuyện nhỏ: `canonical` là câu trả lời cho "vậy làm đúng thì
 * trông thế nào?". Một luật trỏ vào file không tồn tại thì tệ hơn một luật không có con trỏ — người
 * đọc (hoặc agent) mở ra, không thấy gì, rồi kết luận luật đã lỗi thời và bỏ qua nó. Cả cụm luật
 * chết theo cách đó mà không ai sửa gì.
 *
 * Lúc dựng pha 4, cổng này bắt được 14/32 luật đang trỏ vào chỗ không có.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Nơi thử tìm một đường dẫn canonical, theo thứ tự. */
const ROOTS = ['', 'apps/docs', 'packages'];

/** `—` nghĩa là luật CỐ Ý không có canonical (luật về thái độ, không về một file). */
const NONE = '—';

export function checkCanonicals(root, registry) {
  const missing = [];
  const noCanonical = [];
  for (const p of registry.patterns) {
    const c = p.canonical;
    if (!c) {
      noCanonical.push(p.id);
      continue;
    }
    if (c === NONE) continue;
    const found = ROOTS.some((r) => existsSync(join(root, r, c)));
    if (!found) missing.push({ id: p.id, canonical: c });
  }
  return { pass: missing.length === 0 && noCanonical.length === 0, missing, noCanonical };
}
