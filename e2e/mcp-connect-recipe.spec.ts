import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

test.beforeAll(async () => {
  await seedE2eAccount();
});

test('hộp thoại token MCP mang theo cấu hình nối Claude Desktop và ChatGPT', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings?tab=account', { waitUntil: 'networkidle' });
  await page.getByLabel('Tên token').fill('e2e-connect');
  await page.getByRole('button', { name: 'Thêm', exact: true }).click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Token MCP mới' });
  await expect(dialog).toBeVisible({ timeout: 30_000 });

  await expect(dialog).not.toContainText('Hướng dẫn');

  const [claudeBlock, chatgptBlock] = await dialog.locator('pre').all();
  await expect(claudeBlock).toContainText('mcp-remote');
  await expect(claudeBlock).toContainText(`${baseURL}/api/mcp`);
  await expect(claudeBlock).toContainText('Authorization: Bearer ');
  await expect(chatgptBlock).toContainText(`Endpoint: ${baseURL}/api/mcp`);
  await expect(chatgptBlock).toContainText('Authorization: Bearer ');

  const token = (await dialog.locator('code.select-all').innerText()).trim();
  expect(token.length).toBeGreaterThan(20);
  await expect(claudeBlock).toContainText(token);
  await expect(chatgptBlock).toContainText(token);

  await expect(dialog).toHaveCSS('overflow-y', 'auto');
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(16);
  expect(box!.y + box!.height).toBeLessThanOrEqual(552);
});
