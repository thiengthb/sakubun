// Sau khi tạo token MCP, hộp thoại phải đưa ĐỦ thứ để nối Claude Desktop — không chỉ token.
//
// Vì sao cần spec riêng: token chỉ đọc được MỘT lần, ngay tại hộp thoại này, nên đây là khoảnh khắc
// duy nhất công thức nối có chỗ đứng. Công thức đó từng nằm ở tab MCP của trang /guide; khi /guide bị
// gỡ (chuỗi 1/6…6/6), dòng chữ trong hộp thoại vẫn trỏ sang một trang không còn tồn tại và không gate
// nào kêu — cả `Tạo token` lẫn `Token MCP` không xuất hiện trong bất kỳ e2e hay unit test nào trước đó.
// Test này biến "trang bị xoá làm mồ côi một chỉ dẫn" thành một phép kiểm tất định.
import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

test.beforeAll(async () => {
  await seedE2eAccount();
});

test('hộp thoại token MCP mang theo cấu hình nối Claude Desktop', async ({ page, baseURL }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings?tab=account', { waitUntil: 'networkidle' });
  await page.getByLabel('Tên token').fill('e2e-connect');
  await page.getByRole('button', { name: 'Tạo token' }).click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Token MCP mới' });
  await expect(dialog).toBeVisible({ timeout: 30_000 });

  // Không còn trỏ sang trang đã xoá.
  await expect(dialog).not.toContainText('Hướng dẫn');

  // Công thức phải ĐẦY ĐỦ: lệnh, endpoint của CHÍNH deployment này, và header xác thực.
  const block = dialog.locator('pre');
  await expect(block).toContainText('mcp-remote');
  await expect(block).toContainText(`${baseURL}/api/mcp`);
  await expect(block).toContainText('Authorization: Bearer ');

  // Và token thật phải đã được thay vào — đây là điểm khác biệt với công thức cũ trên /guide, nơi
  // người học phải tự đổi chuỗi DÁN_TOKEN_CỦA_BẠN bằng tay.
  const token = (await dialog.locator('code.select-all').innerText()).trim();
  expect(token.length).toBeGreaterThan(20);
  await expect(block).toContainText(token);
});
