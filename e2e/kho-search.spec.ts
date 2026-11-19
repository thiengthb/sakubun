import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// U4f (docs/plans/2026-11-14-u4-kho.md): Kho's search box finds the learner's own items and Kho
// chung's, side by side in place of the level board; "Học" moves a word from one side to the other.

let taken: string | null = null;

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

async function dropTaken() {
  if (!taken) return;
  const { default: Database } = await import('better-sqlite3');
  const { default: path } = await import('node:path');
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  db.pragma('foreign_keys = ON');
  db.prepare(
    `DELETE FROM Item WHERE userId = ${E2E_OWNER} AND source = 'LIBRARY' AND expression = ?`,
  ).run(taken);
  db.close();
}

test.beforeAll(async () => {
  await seedE2eAccount();
});

test.afterAll(async () => {
  await dropTaken();
});

test('the search box swaps the board for two sources, and Học moves a word across', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/resources');
  await expect(page.getByRole('heading', { level: 2, name: /^N5/ })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Tìm trong kho và Kho chung' }).fill('会');
  await page.waitForURL(/\/resources\?q=%E4%BC%9A$/);
  const mine = page.getByRole('region', { name: /^Trong kho của bạn/ });
  const library = page.getByRole('region', { name: /^Trong Kho chung/ });
  await expect(mine).toBeVisible();
  await expect(library).toBeVisible();
  // The board steps aside while there is a query.
  await expect(page.getByRole('heading', { level: 2, name: /^N5/ })).toHaveCount(0);

  // "Học" on Kho chung's first word: it joins the Kho and shows on the learner's side.
  const learn = library.getByRole('button', { name: /^Học / }).first();
  taken = (await learn.getAttribute('aria-label'))!.replace(/^Học /, '');
  await learn.click();
  await expect(page.getByText(/Đã thêm 1 (từ|mẫu)/)).toBeVisible();
  await expect(mine.getByRole('link', { name: `Mở ${taken}` })).toBeVisible();
  await expect(library.getByRole('button', { name: `Học ${taken}` })).toHaveCount(0);

  // Clearing the box brings the board back.
  await page.getByRole('searchbox', { name: 'Tìm trong kho và Kho chung' }).fill('');
  await page.waitForURL(/\/resources$/);
  await expect(page.getByRole('heading', { level: 2, name: /^N5/ })).toBeVisible();
});

test('typing on keeps the text, and leaving by the sidebar empties the box', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/resources');
  const box = page.getByRole('searchbox', { name: 'Tìm trong kho và Kho chung' });

  await box.fill('会');
  await page.waitForURL(/\/resources\?q=%E4%BC%9A$/);
  // A key after the first search: the answer to 会 does not undo it.
  await box.press('End');
  await page.keyboard.type('話');
  await page.waitForURL(/\/resources\?q=%E4%BC%9A%E8%A9%B1$/);
  await expect(box).toHaveValue('会話');
  await expect(box).toBeFocused();

  // "Kho" in the sidebar goes back to the board, and the box follows the address.
  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole('link', { name: 'Kho', exact: true })
    .click();
  await page.waitForURL(/\/resources$/);
  await expect(page.getByRole('heading', { level: 2, name: /^N5/ })).toBeVisible();
  await expect(box).toHaveValue('');
});
