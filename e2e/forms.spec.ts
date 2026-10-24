import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// docs/ui-standard.md › Form (thien, 2026-10-24): a required field has a red * beside its label and
// the form says what the mark means; sending the form with a required field empty puts the error
// under that field; on a laptop the form fills the page's width.

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    db.prepare(
      `INSERT OR REPLACE INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt)
       VALUES ('form-item', 'GRAMMAR', '〜ばかりに', NULL, NULL, 'chỉ vì', 'N2', NULL, 'MCP', NULL, 0, 0, ?)`,
    ).run(new Date().toISOString().replace('Z', '+00:00'));
  } finally {
    db.close();
  }
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

const field = (page: Page, label: string) =>
  page.locator('form').getByRole('textbox', { name: label, exact: true });

test('add grammar: required marks, errors under the fields, full width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/resources/new?kind=grammar', { waitUntil: 'networkidle' });

  await expect(page.getByText('là bắt buộc.').first()).toBeVisible();
  const expression = field(page, 'Mẫu ngữ pháp');
  const meaning = field(page, 'Nghĩa (tiếng Việt)');
  await expect(expression).toHaveAttribute('aria-required', 'true');
  await expect(field(page, 'Cách đọc (kana)')).not.toHaveAttribute('aria-required', 'true');

  await page.getByRole('button', { name: 'Thêm mẫu' }).click();
  await expect(page.getByText('Cần nhập mẫu ngữ pháp')).toBeVisible();
  await expect(page.getByText('Cần nhập nghĩa')).toBeVisible();
  await expect(expression).toHaveAttribute('aria-invalid', 'true');
  await expect(meaning).toHaveAttribute('aria-invalid', 'true');
  await expect(expression).toBeFocused();

  await expression.fill('〜ずにはいられない');
  await expect(page.getByText('Cần nhập mẫu ngữ pháp')).toHaveCount(0);
  await expect(page.getByText('Cần nhập nghĩa')).toBeVisible();

  // The form fills the template's width, not a narrow column.
  const card = await page.locator('form').first().boundingBox();
  const header = await page.locator('[data-template] header').boundingBox();
  expect(card!.width, 'form width').toBeGreaterThan(header!.width - 64);

  // The paste tab says what is missing instead of a silent disabled button.
  await page.getByRole('tab', { name: 'Dán danh sách' }).click();
  await page.getByRole('button', { name: 'Thêm mẫu' }).click();
  await expect(page.getByText('Chưa có mẫu hợp lệ nào để thêm')).toBeVisible();
});

test('edit an item: an emptied required field says so', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/resources/form-item/edit', { waitUntil: 'networkidle' });
  await field(page, 'Nghĩa (tiếng Việt)').fill('');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Cần nhập nghĩa')).toBeVisible();
  await expect(page).toHaveURL(/\/resources\/form-item\/edit$/);
});

test('new group: the name is required', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/groups/new', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Thêm nhóm' }).click();
  await expect(page.getByText('Cần nhập tên nhóm')).toBeVisible();
  await expect(field(page, 'Tên nhóm')).toBeFocused();
});
