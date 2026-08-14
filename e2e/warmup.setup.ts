// Trả trước chi phí COMPILE LẦN ĐẦU của dev server, để nó không nằm trong thời gian của spec đầu tiên.
//
// Vì sao tồn tại (issue #7): `critical-path.spec.ts` timeout 60s ở `locator.fill` trong một lần chạy
// (27/28 spec còn lại xanh), và hai lần chạy khác cùng ngày cùng commit thì 29/29 và 28/28 xanh. Lần
// đỏ chạy ngay sau một `build` 78s trên máy đang tải. Nó không phải bug của app: `critical-path` là
// spec ĐẦU TIÊN theo thứ tự chữ cái, nên nó là spec duy nhất phải trả giá cho lần compile đầu của
// Turbopack cho từng route nó chạm. `timeout: 60_000` đủ khi máy rảnh và không đủ khi máy tải.
//
// Vì sao là một PROJECT chứ không phải trong `globalSetup`: `globalSetup` XOÁ file DB tạm, nên nó
// buộc phải chạy TRƯỚC webServer — nếu ngược lại thì better-sqlite3 của server đã mở inode cũ và mọi
// lần chạy đều gặp đúng con bug mà `playwright.config.ts` cảnh báo cho trường hợp reuse. Chạy trước
// webServer thì chưa có gì để gọi. Một setup project với `dependencies` chạy SAU khi server đã lên.
//
// Dùng `request` chứ không mở browser: chi phí cần trả là SSR/compile ở phía server, và một
// APIRequestContext lấy được đúng thứ đó mà không dựng thêm một trang chromium.

import { expect, test } from '@playwright/test';

/**
 * Mọi route mà bộ e2e thật sự chạm, kể cả route chuyển hướng về `/login` khi chưa đăng nhập —
 * chuyển hướng vẫn phải compile route đó trước, nên nó vẫn là chi phí được trả trước.
 */
const ROUTES = [
  '/login',
  '/',
  '/items',
  '/vocab',
  '/resources',
  '/history',
  '/settings',
  '/groups',
];

test('làm nóng dev server: compile trước mọi route bộ e2e chạm', async ({ request }) => {
  // Ngân sách riêng, rộng: đây CHÍNH là chỗ nhận cục chi phí mà spec đầu tiên từng phải gánh. Nếu
  // vượt cả mức này thì vấn đề không còn là "compile chậm" và đáng đỏ.
  test.setTimeout(240_000);

  for (const route of ROUTES) {
    const res = await request.get(route, { timeout: 120_000 });
    // Không chốt 200: chưa có session nên nhiều route trả về chuyển hướng, và đó là hành vi đúng.
    // Điều cần chốt là server ĐÃ TRẢ LỜI route đó — tức nó đã compile xong, không còn nợ lại cho
    // spec sau. 5xx thì mới là hỏng thật, và biết ngay ở đây tốt hơn biết giữa một spec.
    expect(res.status(), `route ${route} trả lỗi server khi làm nóng`).toBeLessThan(500);
  }
});
