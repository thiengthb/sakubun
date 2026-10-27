import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, E2E_OWNER, seedE2eAccount } from './fixtures';

// Roadmap 7.2d: a stranger signs up and sees nothing of the admin's. Since phase 8 (L4) their library
// starts empty, and Phân tích offers OpenJLPT's N5 grammar from Kho chung in one click.
const EMAIL = 'newcomer@example.test';
const PASSWORD = ['newcomer', 'login', '12345'].join('-');

test('a second account signs up, starts from Kho chung and cannot reach admin pages', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  db.prepare('DELETE FROM user WHERE email = ?').run(EMAIL);
  const ownerItems = () =>
    (db.prepare(`SELECT COUNT(*) n FROM Item WHERE userId = ${E2E_OWNER}`).get() as { n: number })
      .n;
  const before = ownerItems();

  const res = await fetch(`${E2E_BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: E2E_BASE_URL },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Newcomer' }),
  });
  expect(res.status).toBe(200);
  db.prepare('UPDATE user SET emailVerified = 1 WHERE email = ?').run(EMAIL);
  const row = db
    .prepare(
      `SELECT u.role, (SELECT COUNT(*) FROM Item i WHERE i.userId = u.id) items FROM user u WHERE email = ?`,
    )
    .get(EMAIL) as { role: string; items: number };
  expect(row.role).toBe('user');
  expect(row.items).toBe(0);
  expect(ownerItems()).toBe(before);
  db.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/');
  await expect(page.getByText('Kho của bạn còn trống')).toBeVisible();
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'empty-start-1440.png') });
  await page.getByRole('button', { name: 'Lấy bộ N5 · Ngữ pháp' }).click();
  await expect(page.getByText(/^Đã lấy \d+ mẫu về kho$/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Kho của bạn còn trống')).toHaveCount(0);

  // loading.tsx streams the shell first, so the status stays 200; the page swaps to not-found.
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  await expect(page.getByText(E2E_EMAIL)).toHaveCount(0);
  expect((await page.request.get('/api/backup')).status()).toBe(403);
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: 'Mở' })).toHaveCount(0);
});
