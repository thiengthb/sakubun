import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// KJ5 (docs/plans/2026-11-08-kanji.md › Chỗ trong app): Kho chung's level table has a Kanji column;
// a cell opens the level's kanji, and "Lấy cả nhóm" gives each one a card for Ôn nhanh.

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

const shot = async (page: Page, name: string) => {
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
};

test.beforeEach(async () => {
  await seedE2eAccount();
  reset();
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`a level's kanji are taken from Kho chung for Ôn nhanh (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/library', { waitUntil: 'networkidle' });
    const levels = page.locator('[data-slot="library-levels"]');
    await expect(levels.getByRole('columnheader', { name: 'Kanji' })).toBeVisible();
    const n5 = levels.getByRole('link', { name: /^Mở N5 · Kanji: \d+ chữ, chưa có$/ });
    await expect(n5).toBeVisible();
    await shot(page, `kho-chung-kanji-${width}`);

    await n5.click();
    await expect(page.getByRole('heading', { level: 1, name: 'N5 · Kanji' })).toBeVisible();
    await expect(page.locator('[data-slot="kanji-tile"]').first()).toBeVisible();
    await expect(page.locator('[data-slot="kanji-tile"][data-owned]')).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Tìm trong N5 · Kanji' }).fill('nhật');
    await page.locator('[data-slot="kanji-tile"]', { hasText: '日' }).getByRole('button').click();
    await expect(page.getByRole('dialog')).toContainText('[NHẬT]');
    await page.keyboard.press('Escape');
    await page.getByRole('searchbox', { name: 'Tìm trong N5 · Kanji' }).fill('');
    await shot(page, `kho-chung-kanji-n5-${width}`);

    await page.getByRole('button', { name: /^Lấy cả \d+ chữ$/ }).click();
    await expect(page.getByText(/^Đã thêm \d+ chữ/)).toBeVisible();
    await expect(page.locator('[data-slot="group-have"]')).toContainText('Đã có đủ');
    await expect(page.getByRole('button', { name: /^Lấy / })).toHaveCount(0);
    await expect(page.locator('[data-slot="kanji-tile"][data-owned]').first()).toBeVisible();
    await shot(page, `kho-chung-kanji-n5-da-lay-${width}`);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });
}
