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
  // Kho holds both stores: a switch at the top goes between them.
  const pages = page.getByRole('navigation', { name: 'Chuyển trang' });
  await expect(pages.getByRole('link', { name: 'Của bạn' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await pages.getByRole('link', { name: 'Kho chung' }).click();
  await page.waitForURL((u) => u.pathname === '/library');
  await expect(bar.getByRole('link', { name: 'Kho' })).toHaveAttribute('aria-current', 'page');
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(1);

  // The page's last line clears the tab bar once scrolled to the end.
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = (await page.getByRole('button', { name: /Nâng cao/ }).boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);

  // A setting saves itself and its Hoàn tác bar floats above the tab bar, in reach of the thumb
  // wherever the page is scrolled (thien, U1 gate).
  await page.getByRole('button', { name: 'Tăng Từ vựng mới / ngày' }).click();
  const saved = page.locator('[data-sonner-toast]').filter({ hasText: 'Đã lưu' });
  await expect(saved.getByRole('button', { name: 'Hoàn tác' })).toBeVisible();
  // Polled: the bar slides up into place.
  await expect(async () => {
    const box = (await saved.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
  }).toPass();
  await saved.getByRole('button', { name: 'Hoàn tác' }).click();
  await expect(page.getByText('Đã hoàn tác')).toBeVisible();
});

test('the laptop has no tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(nav(page)).toBeHidden();
});

test('Ôn nhanh shows how many cards are due, and the bar stays in the session', async ({
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
  // The session keeps the tab bar like every other page (thien, 2026-11-13); the X still leads out,
  // and the answer bar rests on top of the tab bar, never under it.
  await expect(nav(page)).toBeVisible();
  const tabTop = (await nav(page).boundingBox())!.y;
  const answers = page.getByRole('button', { name: /^(Xem đáp án|Đã xem|Tiếp)$/ }).first();
  await expect(async () => {
    const box = (await answers.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(tabTop);
  }).toPass();
  await page.getByRole('button', { name: 'Dừng ôn' }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await expect(nav(page)).toBeVisible();

  // With nothing due the tab has no count.
  seedDue(0);
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(nav(page).getByRole('link', { name: 'Ôn nhanh', exact: true })).toBeVisible();
  await expect(nav(page).locator('[data-badge]')).toHaveCount(0);
});

// U2a (docs/plans/2026-11-13-u2-study-session.md), as thien set it on 2026-11-13: on a laptop the
// session keeps the sidebar and the width of every other page. The X sits at the end of the
// title's row, above a progress bar a screen reader can follow.
test('on a laptop the session keeps the sidebar and the page frame', async ({ page }) => {
  seedDue(2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);
  await page.goto('/settings', { waitUntil: 'networkidle' });
  const sidebar = page.locator('[data-sidebar="sidebar"]').first();
  await expect(sidebar).toBeVisible();
  const settingsBox = (await page.locator('main [data-template]').boundingBox())!;

  await page.goto('/review', { waitUntil: 'networkidle' });
  await expect(sidebar).toBeVisible();
  const box = (await page.locator('main [data-template]').boundingBox())!;
  expect(Math.round(box.x)).toBe(Math.round(settingsBox.x));
  expect(Math.round(box.width)).toBe(Math.round(settingsBox.width));
  const close = page.getByRole('button', { name: 'Dừng ôn' });
  const title = page.getByRole('heading', { level: 1, name: 'Ôn nhanh' });
  await expect(close).toBeVisible();
  expect((await close.boundingBox())!.x).toBeGreaterThan((await title.boundingBox())!.x);
  const progress = page.getByRole('progressbar', { name: /^Thẻ 1 \/ \d+$/ });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');

  // Enter on a focused sidebar link follows the link; it does not answer the card.
  await page.locator('[data-sidebar="menu-button"]', { hasText: 'Cài đặt' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.pathname === '/settings');
  await expect(sidebar).toBeVisible();
});

test('the due count follows the session once it ends', async ({ page }) => {
  seedDue(2);
  await page.setViewportSize(PHONE);
  await logIn(page);
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(nav(page).locator('[data-badge]')).toHaveText('2');

  await nav(page)
    .getByRole('link', { name: /^Ôn nhanh/ })
    .click();
  await page.waitForURL((u) => u.pathname === '/review');
  // The session may add new kanji after the two due words; answer whatever comes until the end.
  const end = page.getByText('Xong buổi ôn');
  for (let n = 0; n < 20 && !(await end.isVisible()); n++) {
    const reveal = page.getByRole('button', { name: 'Xem đáp án' });
    const seen = page.getByRole('button', { name: 'Đã xem' });
    const choices = page.getByRole('group', { name: 'Chọn đáp án' });
    await expect(reveal.or(seen).or(choices).or(end)).toBeVisible();
    if (await end.isVisible()) break;
    const before = await page.locator('[aria-label^="Thẻ "]').getAttribute('aria-label');
    if (await seen.isVisible()) await seen.click();
    else if (await reveal.isVisible()) {
      await reveal.click();
      await page.getByRole('button', { name: /^Nhớ/ }).click();
    } else {
      await choices.getByRole('button').first().click();
      await page.getByRole('button', { name: 'Tiếp' }).click();
    }
    await expect(async () => {
      const now = await page.locator('[aria-label^="Thẻ "]').getAttribute('aria-label');
      expect((await end.isVisible()) || now !== before).toBe(true);
    }).toPass();
  }
  await expect(end).toBeVisible();

  // The root layout does not re-render on a client-side move, so the count is fetched again
  // when the session ends: no stale "2" on the tab after both cards were answered.
  await expect(nav(page)).toBeVisible();
  await expect(nav(page).locator('[data-badge]')).toHaveCount(0);
  // The summary's main button rests above the bar that came back, not under it.
  const home = (await page.getByRole('link', { name: 'Về trang chính' }).boundingBox())!;
  expect(home.y + home.height).toBeLessThanOrEqual((await nav(page).boundingBox())!.y);
  // (Hội thoại, not Phân tích: the dev server's own badge sits over the leftmost tab.)
  await nav(page).getByRole('link', { name: 'Hội thoại' }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/kaiwa'));
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
