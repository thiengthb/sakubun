import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// Roadmap 7.2c: the admin sees every account and can ban, unban or delete a learner.
const LEARNERS = [
  { id: 'adm-lan', name: 'Lan', email: 'lan@example.test', banned: 0, items: 3 },
  { id: 'adm-minh', name: 'Minh', email: 'minh@example.test', banned: 0, items: 1 },
  { id: 'adm-quan', name: 'Quân', email: 'quan@example.test', banned: 1, items: 0 },
];

function seedLearners() {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
  const now = Date.now();
  // Other specs sign up accounts too; this page counts every account.
  db.prepare('DELETE FROM user WHERE email != ?').run(E2E_EMAIL);
  for (const [i, u] of LEARNERS.entries()) {
    db.prepare(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, role, banned)
       VALUES (?, ?, ?, 1, ?, ?, 'user', ?)`,
    ).run(u.id, u.name, u.email, iso(now - (3 - i) * 86_400_000), iso(now), u.banned);
    for (let n = 0; n < u.items; n++)
      db.prepare(
        `INSERT INTO Item (id, userId, kind, expression, meaningVi, level, source, createdAt)
         VALUES (?, ?, 'VOCAB', ?, 'x', 'N5', 'OPENJLPT', ?)`,
      ).run(`${u.id}-i${n}`, u.id, `${u.id}-語${n}`, iso(now));
  }
  db.prepare(
    `INSERT INTO ReviewLog (id, userId, itemId, rating, state, due, stability, difficulty, reviewedAt)
     VALUES ('adm-log', 'adm-lan', 'adm-lan-i0', 3, 2, ?, 1, 5, ?)`,
  ).run(iso(now + 86_400_000), iso(now - 3_600_000));
  db.close();
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

const card = (page: Page, email: string) => page.getByRole('listitem').filter({ hasText: email });

async function fromMenu(page: Page, email: string, item: string) {
  await page.getByRole('button', { name: `Tác vụ cho ${email}` }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

test('admin page: list, account page, ban, unban and delete a learner', async ({ page }) => {
  await seedE2eAccount();
  seedLearners();
  await login(page);
  const shots = process.env.SCREENSHOT_DIR;
  const snap = async (name: string) => {
    if (!shots) return;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: path.join(shots, `${name}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  };

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Quản trị' })).toBeVisible();
  await expect(page.getByText('4 tài khoản')).toBeVisible();
  await expect(card(page, E2E_EMAIL).getByRole('button')).toHaveCount(0);
  await expect(card(page, 'quan@example.test').getByText('Bị chặn')).toBeVisible();
  await snap('admin');

  // The card opens the account page: the facts that left the card, and the learner's own numbers.
  await page.getByRole('link', { name: 'Mở tài khoản lan@example.test' }).click();
  await page.waitForURL('**/admin/adm-lan');
  await expect(page.getByRole('heading', { name: 'Lan', exact: true })).toBeVisible();
  await expect(page.getByText('Người học', { exact: true })).toBeVisible();
  await expect(page.getByText('Đến hạn', { exact: true })).toBeVisible();
  await expect(page.getByText('1 năm', { exact: true })).toBeVisible();
  await snap('admin-account');

  await fromMenu(page, 'lan@example.test', 'Chặn');
  await page.getByRole('dialog').getByRole('button', { name: 'Chặn' }).click();
  await expect(page.getByText('Bị chặn', { exact: true })).toBeVisible();

  await page.goto('/admin/adm-quan', { waitUntil: 'networkidle' });
  await expect(page.getByText('Chưa có mục nào')).toBeVisible();

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(card(page, 'lan@example.test').getByText('Bị chặn')).toBeVisible();
  await fromMenu(page, 'quan@example.test', 'Bỏ chặn');
  await page.getByRole('dialog').getByRole('button', { name: 'Bỏ chặn' }).click();
  await expect(card(page, 'quan@example.test').getByText('Người học')).toBeVisible();

  await fromMenu(page, 'minh@example.test', 'Xoá tài khoản');
  const dialog = page.getByRole('dialog');
  if (shots) await dialog.screenshot({ path: path.join(shots, 'admin-delete-dialog.png') });
  await dialog.getByRole('button', { name: 'Xoá' }).click();
  await expect(page.getByText('Gõ đúng email của tài khoản để xác nhận xoá.')).toBeVisible();
  await dialog.getByLabel('Email của tài khoản cần xoá').fill('Minh@Example.test');
  await dialog.getByRole('button', { name: 'Xoá' }).click();
  await expect(card(page, 'minh@example.test')).toHaveCount(0);
  await expect(page.getByText('3 tài khoản')).toBeVisible();
});
