import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// U4e2 (docs/plans/2026-11-14-u4-kho.md): Kho's "Thêm" opens a panel with four ways to add; the first
// three open where that way lives, "Tự viết" adds one item without leaving the page.

const WORD = '追加試験語';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

async function dropWord() {
  const { default: Database } = await import('better-sqlite3');
  const { default: path } = await import('node:path');
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  db.pragma('foreign_keys = ON');
  db.prepare(`DELETE FROM Item WHERE userId = ${E2E_OWNER} AND expression = ?`).run(WORD);
  db.close();
}

test.beforeAll(async () => {
  await seedE2eAccount();
  await dropWord();
});

test.afterAll(async () => {
  await dropWord();
});

test('Thêm opens four ways and adds one word in place', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/resources/outside');

  await page.getByRole('button', { name: 'Thêm' }).click();
  const panel = page.getByRole('dialog', { name: 'Thêm vào kho' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link', { name: /Lấy theo cấp JLPT/ })).toHaveAttribute(
    'href',
    '/resources',
  );
  await expect(panel.getByRole('link', { name: /Bộ người khác chia sẻ/ })).toHaveAttribute(
    'href',
    '/library',
  );
  await expect(panel.getByRole('link', { name: /Nhờ Claude soạn/ })).toHaveAttribute(
    'href',
    '/settings?tab=guide',
  );

  // "Tự viết": a word, typed in the panel; the page behind counts it.
  await panel.getByLabel(/Từ \(tiếng Nhật\)/).fill(WORD);
  await panel.getByLabel(/Nghĩa/).fill('từ thử của e2e');
  await panel.getByRole('button', { name: 'Thêm từ' }).click();
  await expect(page.getByText('Đã thêm từ vào kho')).toBeVisible();
  await expect(panel.getByLabel(/Từ \(tiếng Nhật\)/)).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  await page.goto('/resources/outside/manual');
  await expect(page.getByRole('link', { name: `Mở ${WORD}` })).toBeVisible();
});

test('on a phone Thêm is a sheet near full height, and a way closes it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/resources');

  await page.getByRole('button', { name: 'Thêm' }).click();
  const sheet = page.getByRole('dialog', { name: 'Thêm vào kho' });
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(389);
  expect(box.height).toBeGreaterThan(844 * 0.8);

  await sheet.getByRole('link', { name: /Bộ người khác chia sẻ/ }).click();
  await page.waitForURL(/\/library/);
  await expect(sheet).toBeHidden();
});
