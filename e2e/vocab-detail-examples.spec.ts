// Một từ vựng có CẢ câu ví dụ lưu trên Item LẪN thẻ enrichment phải hiện ĐÚNG MỘT mục «Ví dụ».
//
// Vì sao cần một spec riêng thay vì thêm assertion vào lưới sẵn có: seed của `mobile-layout.spec.ts`
// đặt `notes` = NULL cho mọi Item (nó ghi hằng `NULL` thẳng trong câu INSERT), nên đường mà lỗi này
// sống — vocab CÓ `notes` VÀ CÓ thẻ — chưa bao giờ được một lưới nào chạm tới. Đó là lý do hai mục
// «Ví dụ» chồng nhau tồn tại trên hai màn (trang chi tiết và hộp xem nhanh) mà không gate nào kêu.
//
// Đo 2026-08-14 trên mã trước khi sửa: 2 mục. Sau khi sửa: 1, và không câu nào biến mất.
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

/** Câu lưu trên Item — `add_vocab` gửi kèm từ, không có ruby và không có bản dịch. */
const STORED = '毎朝コーヒーを飲みます。';
/** Câu của THẺ — giàu hơn: có `vi`, có `jaRuby`. Đây là lý do nó được xếp trước. */
const CARD_EXAMPLE = 'お茶を飲みました。';
/**
 * Neo assertion vào bản DỊCH, không vào câu Nhật. `SpokenLine` render furigana bằng `<ruby>`, nên
 * `innerText` trả về `お茶ちゃを飲のみました。` — cách đọc xen vào giữa. Đo được ở lần chạy đầu:
 * assertion neo vào câu Nhật đỏ trong khi màn hình hiển thị hoàn toàn đúng. Câu lưu trên Item thì
 * KHÔNG có ruby nên nó khớp nguyên văn, và chính sự khác nhau đó là thứ đáng giữ trong test.
 */
const CARD_EXAMPLE_VI = 'Đã uống trà.';

const CARD = JSON.stringify({
  structure: [],
  usage: 'Động từ nhóm 1, tha động từ: 〜を飲む.',
  collocations: [],
  example: { ja: '水を飲む。', vi: 'Uống nước.', jaRuby: '水[みず]を飲[の]む。' },
  examples: [{ ja: CARD_EXAMPLE, vi: 'Đã uống trà.', jaRuby: 'お茶[ちゃ]を飲[の]みました。' }],
  pitfalls: [],
  contrasts: [],
  synonyms: [],
  antonyms: [],
  register: '',
  v: 3,
});

const ID = 'vocab-examples';

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    // Re-runnable: một lần chạy hỏng sẽ khởi động lại worker và chạy lại hook này trên DB đã có dòng,
    // mà Item unique trên [kind, expression] — cùng bẫy mà seed của mobile-layout đã vấp.
    db.prepare('DELETE FROM Item WHERE id = ?').run(ID);
    db.prepare(
      `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
                         captureReason, suspended, starred, createdAt, challengeObservations, enrichment)
       VALUES (?, 'VOCAB', '飲む', 'のむ', 'ẩm', 'uống', 'N5', ?, 'MCP', NULL, 0, 0, ?, 0, ?)`,
    ).run(ID, STORED, new Date().toISOString().replace('Z', '+00:00'), CARD);
  } finally {
    db.close();
  }
});

test('chi tiết từ vựng: một mục «Ví dụ», và không câu nào bị mất', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto(`/resources/${ID}`, { waitUntil: 'networkidle' });
  // Tab mặc định là "Chỉ số & lịch"; thẻ nội dung nằm ở tab chi tiết.
  await page.getByRole('tab', { name: /Chi tiết/ }).click();

  // ĐÚNG MỘT — đây là toàn bộ hợp đồng. `exact` để không dính "Nghe ví dụ" của nút phát.
  await expect(page.getByText('Ví dụ', { exact: true })).toHaveCount(1);

  // Và gộp lại KHÔNG được làm mất dữ liệu: cả câu của thẻ lẫn câu lưu trên Item đều phải còn.
  const body = page.locator('body');
  await expect(body).toContainText(CARD_EXAMPLE_VI);
  await expect(body).toContainText(STORED);
});
