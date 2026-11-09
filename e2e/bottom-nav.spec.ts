import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// UI v2, phase 1 (docs/plans/2026-11-08-ui-v2.md › Khung điều hướng): on a phone, five tabs at the
// foot with their names always showing, a due count on Ôn nhanh, out of the way while typing and
// during a study session. The edge rail is gone.

const PHONE = { width: 390, height: 844 };

function seedDue(count: number) {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    for (let i = 0; i < count; i++) {
      db.prepare(
        `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
           captureReason, suspended, starred, createdAt)
         VALUES (${E2E_OWNER}, ?, 'VOCAB', ?, 'よみ', NULL, 'nghĩa', 'N5', NULL, 'MCP', NULL, 0, 0, ?)`,
      ).run(`bn${i}`, `語${i}`, new Date(now - 10 * 86_400_000).toISOString());
      db.prepare(
        `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays,
           learningSteps, reps, lapses, state, lastReview)
         VALUES (${E2E_OWNER}, ?, ?, ?, 4, 5, 3, 0, 2, 0, 2, ?)`,
      ).run(
        `sbn${i}`,
        `bn${i}`,
        new Date(now - 86_400_000).toISOString(),
        new Date(now - 4 * 86_400_000).toISOString(),
      );
    }
  } finally {
    db.close();
  }
}

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Điều hướng chính' });

test.beforeAll(async () => {
  await seedE2eAccount();
});

test('the phone shows five named tabs, and the edge rail is gone', async ({ page }) => {
  seedDue(0);
  await page.setViewportSize(PHONE);
  await logIn(page);
  await page.goto('/settings', { waitUntil: 'networkidle' });

  const bar = nav(page);
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('link')).toHaveText([
    'Phân tích',
    'Ôn nhanh',
    'Hội thoại',
    'Kho',
    'Bạn',
  ]);
  await expect(page.getByRole('button', { name: 'Mở thanh điều hướng' })).toHaveCount(0);

  // 56px, flush with the foot of the screen, each tab at least the 44px touch target.
  const box = (await bar.boundingBox())!;
  expect(box.y + box.height).toBe(PHONE.height);
  for (const link of await bar.getByRole('link').all()) {
    const b = (await link.boundingBox())!;
    expect(b.height).toBe(56);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }

  // Cài đặt sits under Bạn; Kho covers both stores.
  await expect(bar.getByRole('link', { name: 'Bạn' })).toHaveAttribute('aria-current', 'page');
  await bar.getByRole('link', { name: 'Kho' }).click();
  await page.waitForURL((u) => u.pathname === '/resources');
  await expect(bar.getByRole('link', { name: 'Kho' })).toHaveAttribute('aria-current', 'page');
  await page.goto('/library', { waitUntil: 'networkidle' });
  await expect(bar.getByRole('link', { name: 'Kho' })).toHaveAttribute('aria-current', 'page');
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(1);

  // The form's sticky Lưu bar rides above the tab bar, and the page's last line clears it too.
  await page.goto('/settings', { waitUntil: 'networkidle' });
  const sticky = (await page.getByRole('button', { name: 'Lưu', exact: true }).boundingBox())!;
  expect(sticky.y + sticky.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const save = (await page.getByRole('button', { name: 'Lưu', exact: true }).boundingBox())!;
  const top = (await bar.boundingBox())!.y;
  expect(save.y + save.height).toBeLessThanOrEqual(top);
});

test('the laptop has no tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(nav(page)).toBeHidden();
});

test('Ôn nhanh shows how many cards are due, and the bar steps aside in the session', async ({
  page,
}) => {
  seedDue(3);
  await page.setViewportSize(PHONE);
  await logIn(page);
  await page.goto('/settings', { waitUntil: 'networkidle' });
  const review = nav(page).getByRole('link', { name: /^Ôn nhanh/ });
  await expect(review).toHaveAccessibleName(/^Ôn nhanh\s*, 3 thẻ đến hạn$/);
  await expect(review.locator('[data-badge]')).toHaveText('3');

  await review.click();
  await page.waitForURL((u) => u.pathname === '/review');
  await expect(nav(page)).toHaveCount(0);

  // With nothing due the tab has no count.
  seedDue(0);
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(nav(page).getByRole('link', { name: 'Ôn nhanh', exact: true })).toBeVisible();
  await expect(nav(page).locator('[data-badge]')).toHaveCount(0);
});

test('the bar steps aside while the keyboard is up', async ({ page }) => {
  seedDue(0);
  await page.setViewportSize(PHONE);
  await logIn(page);
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(nav(page)).toBeVisible();
  await page.getByRole('textbox', { name: 'Từ vựng mới / ngày', exact: true }).focus();
  await expect(nav(page)).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Từ vựng mới / ngày', exact: true }).blur();
  await expect(nav(page)).toBeVisible();
});
