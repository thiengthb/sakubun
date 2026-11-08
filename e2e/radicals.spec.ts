import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// KJ7 (docs/plans/2026-11-08-kanji.md › Bộ thủ và mạng lưới): the radicals page lists the 214
// radicals by stroke count with what the learner has met; a radical opens its kanji, and a kanji
// its own page.

function seed() {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}" WHERE userId = ${E2E_OWNER}`);
    // 海 is remembered: radical 85 (水) shows one kanji met.
    db.prepare(
      `INSERT INTO Item (userId, id, kind, expression, hanviet, meaningVi, level, source, suspended, starred, createdAt)
       VALUES (${E2E_OWNER}, 'k1', 'KANJI', '海', 'HẢI', 'biển', 'N4', 'JOYO', 0, 0, ?)`,
    ).run(new Date().toISOString());
    db.prepare(
      `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays, learningSteps, reps, lapses, state)
       VALUES (${E2E_OWNER}, 's1', 'k1', ?, 4, 5, 3, 0, 2, 0, 2)`,
    ).run(new Date(Date.now() + 86_400_000).toISOString());
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
  seed();
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`the radicals page opens a radical's kanji (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/resources?tab=kanji', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Bộ thủ' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bộ thủ' })).toBeVisible();
    await expect(page.locator('[data-slot="radical-tile"]')).toHaveCount(214);
    await shot(page, `bo-thu-${width}`);

    const water = page.getByRole('link', { name: /^Bộ 水 thủy: \d+ chữ Jōyō, đã gặp 1$/ });
    await water.scrollIntoViewIfNeeded();
    await water.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bộ 水 thủy' })).toBeVisible();
    await expect(page.getByRole('link', { name: '海 [HẢI], đã nhớ' })).toBeVisible();
    await shot(page, `bo-thu-thuy-${width}`);
    await page.getByRole('link', { name: '海 [HẢI], đã nhớ' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '海 [HẢI]' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });
}
