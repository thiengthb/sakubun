import path from 'node:path';
import { expect, test } from '@playwright/test';

// Google's consent screen links to these two pages, so they must open without signing in.
test('chính sách bảo mật và điều khoản mở được khi chưa đăng nhập, có link từ trang đăng nhập', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Chính sách bảo mật' }).click();
  await page.waitForURL('**/privacy');
  await expect(page.getByRole('heading', { name: 'Chính sách bảo mật', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Xoá dữ liệu' })).toBeVisible();

  const res = await page.goto('/terms');
  expect(res?.status()).toBe(200);
  expect(page.url()).toContain('/terms');
  await expect(page.getByRole('heading', { name: 'Điều khoản sử dụng', level: 1 })).toBeVisible();

  const shots = process.env.SCREENSHOT_DIR;
  if (shots)
    for (const name of ['privacy', 'terms'])
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.goto(`/${name}`);
        await page.screenshot({ path: path.join(shots, `${name}-${width}.png`), fullPage: true });
      }
});
