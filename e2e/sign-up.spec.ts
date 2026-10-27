import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, E2E_OWNER, seedE2eAccount } from './fixtures';

// Roadmap 7.2d: a stranger signs up, gets their own OpenJLPT deck, and sees nothing of the admin's.
const EMAIL = 'newcomer@example.test';
const PASSWORD = ['newcomer', 'login', '12345'].join('-');

test('a second account signs up, learns from its own deck and cannot reach admin pages', async ({
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
  expect(row.items).toBeGreaterThan(7000);
  expect(ownerItems()).toBe(before);
  db.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  const admin = await page.goto('/admin');
  expect(admin?.status()).toBe(404);
  expect((await page.request.get('/api/backup')).status()).toBe(403);
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: 'Mở' })).toHaveCount(0);
  expect(E2E_EMAIL).not.toBe(EMAIL);
});
