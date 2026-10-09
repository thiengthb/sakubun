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

  await expect(dialog).not.toContainText('Hướng dẫn');

  const block = dialog.locator('pre');
  await expect(block).toContainText('mcp-remote');
  await expect(block).toContainText(`${baseURL}/api/mcp`);
  await expect(block).toContainText('Authorization: Bearer ');

  const token = (await dialog.locator('code.select-all').innerText()).trim();
  expect(token.length).toBeGreaterThan(20);
  await expect(block).toContainText(token);
});
