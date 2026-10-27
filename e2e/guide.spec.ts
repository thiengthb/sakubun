import path from 'node:path';
import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// Roadmap 7.3a: Settings > Hướng dẫn walks a new learner from sign-in to connecting Claude.
test('Hướng dẫn tab: connector address, start phrase, links to other tabs', async ({
  page,
  baseURL,
}) => {
  await seedE2eAccount();
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings?tab=guide', { waitUntil: 'networkidle' });
  const tab = page.getByRole('tabpanel');
  await expect(tab.getByRole('heading', { name: '1. Kết nối Claude' })).toBeVisible();
  await expect(tab.locator('code').first()).toHaveText(`${baseURL}/api/mcp`);
  await expect(tab.locator('code').nth(1)).toHaveText('Học tiếng Nhật với sakubun');
  await expect(tab.getByRole('button', { name: 'Chép địa chỉ MCP' })).toBeVisible();
  // Read-only: no Save footer on this tab.
  await expect(page.getByRole('button', { name: 'Lưu' })).toHaveCount(0);

  const shots = process.env.SCREENSHOT_DIR;
  if (shots)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: path.join(shots, `guide-${width}.png`), fullPage: true });
    }

  await tab.getByRole('button', { name: 'Luyện tập' }).click();
  await expect(page).not.toHaveURL(/tab=guide/);
  await expect(page.getByRole('tabpanel')).toContainText('Mẫu mới');
});
