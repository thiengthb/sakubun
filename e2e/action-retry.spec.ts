import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// UI v2 B10: a server action that never answers (offline, the server restarting mid-deploy) shows a
// short toast with "Thử lại" instead of crashing the page, and "Thử lại" sends the same call again.

function reset() {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}" WHERE userId = ${E2E_OWNER}`);
  } finally {
    db.close();
  }
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.beforeEach(async () => {
  await seedE2eAccount();
  reset();
});

test('a server action that never answers offers "Thử lại", and the retry goes through', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/library', { waitUntil: 'networkidle' });
  await page
    .locator('[data-slot="library-levels"]')
    .getByRole('link', { name: /^Mở N5 · Kanji: / })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'N5 · Kanji' })).toBeVisible();

  // Server actions are POSTs carrying a Next-Action header: drop them as a dead network would.
  const offline = (route: import('@playwright/test').Route) =>
    route.request().method() === 'POST' && route.request().headers()['next-action']
      ? route.abort('internetdisconnected')
      : route.continue();
  await page.route('**/*', offline);
  await page.getByRole('button', { name: /^Lấy cả \d+ chữ$/ }).click();

  const toast = page.locator('[data-sonner-toast]', {
    hasText: 'Không gửi được. Kiểm tra mạng rồi thử lại.',
  });
  await expect(toast).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'N5 · Kanji' })).toBeVisible();

  await page.unroute('**/*', offline);
  await toast.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText(/^Đã thêm \d+ chữ/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Lấy / })).toHaveCount(0);
});
