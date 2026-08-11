import { expect, test, type Browser } from '@playwright/test';
import { E2E_BASE_URL, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

test.beforeAll(seedE2eAccount);

/**
 * Cái người học thấy TRƯỚC khi JavaScript chạy.
 *
 * Tắt JS trong Playwright cho ta đúng bằng HTML server trả về — không phải một xấp xỉ của nó — nên phép
 * kiểm này tất định và không có model nào trong vòng lặp. Nó tồn tại vì một lớp lỗi đo được trên
 * production 2026-08-12: `/settings` hiện 6 ô chọn RỖNG cho tới khi React hydrate. Radix tra nhãn từ
 * `SelectItem` đang chọn, mà khi select đóng thì danh sách item chỉ mount ở client (xem docstring của
 * `SelectValue` trong `components/ui/select.tsx`), nên `<SelectValue />` trơn không in ra gì ở SSR.
 *
 * Phép kiểm tự khoanh đúng phạm vi: select trong popover/dialog KHÔNG có trong HTML đầu tiên, nên nó
 * không đòi hỏi gì ở những chỗ mà lúc người học mở ra React đã hydrate từ lâu. Không cần allowlist, và
 * không có allowlist nào để mục.
 *
 * Vì sao lại đáng gác dù nháy rất nhanh ở máy nhanh: ô trống không phải trạng thái hiển thị hợp lệ. Người
 * học đọc sáu ô trống ở trang Cài đặt thành "mọi thiết lập của mình đã mất" — cùng lớp lỗi với ô điểm
 * trống ở `lib/score-label.ts`.
 */

/** Đăng nhập một lần (form login CẦN JS), rồi mang cookie sang một context KHÔNG có JS. */
async function noJsPage(browser: Browser) {
  const authed = await browser.newContext({ baseURL: E2E_BASE_URL });
  const page = await authed.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  const storageState = await authed.storageState();
  await authed.close();

  const noJs = await browser.newContext({
    baseURL: E2E_BASE_URL,
    storageState,
    javaScriptEnabled: false,
  });
  return { noJs, page: await noJs.newPage() };
}

test('không có JS, mọi ô chọn trong HTML đầu tiên đã có chữ', async ({ browser }) => {
  const { noJs, page } = await noJsPage(browser);

  const empty: string[] = [];
  let total = 0;

  for (const path of ['/', '/resources', '/history', '/settings']) {
    await page.goto(path);
    // `textContent` (không phải toBeVisible): ta đang kiểm NỘI DUNG của HTML server, và một ô có thể bị
    // CSS ẩn hợp lệ — `TabSelect` render cả hai nửa rồi ẩn một nửa theo bề rộng.
    const texts = await page.locator('[data-slot="select-value"]').allTextContents();
    total += texts.length;
    texts.forEach((t, i) => {
      if (!t.trim()) empty.push(`${path} → ô chọn thứ ${i + 1}`);
    });

    // Riêng Cài đặt: đây là trang có ca lỗi thật, nên khẳng định luôn số ô. Nếu một ngày các select ở đây
    // biến mất thì phép kiểm phải ĐỎ, không phải xanh vì không còn gì để kiểm.
    if (path === '/settings') expect(texts.length, 'số ô chọn ở Cài đặt').toBeGreaterThanOrEqual(5);
  }

  expect(empty, 'ô chọn rỗng trong HTML server').toEqual([]);
  expect(total, 'tổng số ô chọn đã kiểm').toBeGreaterThanOrEqual(6);

  await noJs.close();
});
