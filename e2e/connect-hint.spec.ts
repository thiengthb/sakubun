import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// Roadmap 7.3b: a learner with no AI app connected and no review yet is sent to the guide from
// Phân tích; the hint goes away once they connect one.
function db() {
  return new Database(path.join(process.cwd(), E2E_DB_FILE));
}

test('Phân tích points a new learner at the guide until an AI app is connected', async ({
  page,
}) => {
  await seedE2eAccount();
  const d = db();
  // Other specs connect apps, make tokens and review; start from a learner who has done none of it.
  d.exec(`DELETE FROM oauthConsent WHERE userId = ${E2E_OWNER}`);
  d.exec(`DELETE FROM mcp_key WHERE userId = ${E2E_OWNER}`);
  d.exec(`DELETE FROM ReviewLog WHERE userId = ${E2E_OWNER}`);
  d.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  // Leave Settings on another tab first: the hint's ?tab=guide must still win.
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Tài khoản' }).click();

  await page.goto('/', { waitUntil: 'networkidle' });
  const hint = page.getByRole('status').filter({ hasText: 'Kết nối Claude để bắt đầu luyện' });
  await expect(hint).toBeVisible();

  const shots = process.env.SCREENSHOT_DIR;
  if (shots)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: path.join(shots, `connect-hint-${width}.png`) });
    }

  await hint.getByRole('link', { name: 'Xem hướng dẫn' }).click();
  await page.waitForURL(/\/settings\?tab=guide/);
  await expect(page.getByRole('heading', { name: '1. Kết nối Claude' })).toBeVisible();

  const d2 = db();
  d2.prepare(
    `INSERT INTO mcp_key (id, userId, name, tokenHash, scope, createdAt)
     VALUES ('hint-key', ${E2E_OWNER}, 'desktop', 'hint-hash', 'full', ?)`,
  ).run(new Date().toISOString());
  d2.close();
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByText('Kết nối Claude để bắt đầu luyện')).toHaveCount(0);
});
