import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// UI v2 U3b (docs/plans/2026-11-14-u3-today.md): the app opens on Hôm nay, whose lead area counts
// the cards due and starts the session in one tap. U3d: the states after a session has started.

/** `reviewed` reviews logged a minute ago; `later` puts every card's next date two days out. */
function seedDue(count: number, { reviewed = 0, later = false } = {}) {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  try {
    for (const t of [
      'GroupMember',
      'Group',
      'ReviewLog',
      'SrsState',
      'Sentence',
      'Item',
      'Settings',
    ])
      db.exec(`DELETE FROM "${t}"`);
    // Only the seeded words: no kanji brought in by Ôn nhanh.
    db.prepare(
      `INSERT INTO Settings (userId, data, updatedAt) VALUES (${E2E_OWNER}, '{"dailyNewKanji":0}', ?)`,
    ).run(new Date().toISOString());
    for (let i = 0; i < count; i++) {
      db.prepare(
        `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
           captureReason, suspended, starred, createdAt)
         VALUES (${E2E_OWNER}, ?, 'VOCAB', ?, 'よみ', NULL, 'nghĩa', 'N5', NULL, 'MCP', NULL, 0, 0, ?)`,
      ).run(`td${i}`, `語${i}`, new Date(now - 10 * 86_400_000).toISOString());
      db.prepare(
        `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays,
           learningSteps, reps, lapses, state, lastReview)
         VALUES (${E2E_OWNER}, ?, ?, ?, 4, 5, 3, 0, 2, 0, 2, ?)`,
      ).run(
        `std${i}`,
        `td${i}`,
        new Date(later ? now + 2 * 86_400_000 : now - 86_400_000).toISOString(),
        new Date(now - 4 * 86_400_000).toISOString(),
      );
    }
    for (let i = 0; i < reviewed; i++)
      db.prepare(
        `INSERT INTO ReviewLog (userId, id, itemId, rating, state, role, due, stability, difficulty, reviewedAt)
         VALUES (${E2E_OWNER}, ?, ?, 3, 2, 'TARGET', ?, 4, 5, ?)`,
      ).run(
        `rtd${i}`,
        `td${i % count}`,
        new Date(now + 86_400_000).toISOString(),
        new Date(now - 60_000).toISOString(),
      );
  } finally {
    db.close();
  }
}

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => u.pathname === '/', { timeout: 30_000 });
}

test.beforeAll(seedE2eAccount);

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`at ${viewport.width}px, Hôm nay counts the due cards and "Bắt đầu ôn" opens the first`, async ({
    page,
  }) => {
    seedDue(3);
    await page.setViewportSize(viewport);
    await logIn(page);

    await expect(page.getByRole('heading', { name: 'Hôm nay', level: 1 })).toBeVisible();
    const hero = page.getByRole('region', { name: 'Hôm nay' });
    await expect(hero).toContainText('Đến hạn hôm nay');
    await expect(hero.getByText('3', { exact: true })).toBeVisible();
    await expect(hero).toContainText('khoảng 2 phút');

    await hero.getByRole('link', { name: 'Bắt đầu ôn' }).click();
    await page.waitForURL((u) => u.pathname === '/review');
    await expect(page.locator('[aria-label^="Thẻ "]').first()).toBeVisible();
  });
}

test('after some reviews today, the lead area says how many and offers "Học tiếp"', async ({
  page,
}) => {
  seedDue(3, { reviewed: 2 });
  await logIn(page);
  const hero = page.getByRole('region', { name: 'Hôm nay' });
  await expect(hero).toContainText('Đã ôn 2 thẻ hôm nay');
  await expect(hero.getByRole('link', { name: 'Học tiếp, còn 3 thẻ' })).toBeVisible();
});

test('with nothing left, the lead area praises the reviews done and names the next card', async ({
  page,
}) => {
  seedDue(3, { reviewed: 3, later: true });
  await logIn(page);
  const hero = page.getByRole('region', { name: 'Hôm nay' });
  await expect(hero).toContainText('Xong hết hôm nay');
  await expect(hero).toContainText('Hôm nay bạn đã ôn 3 thẻ, nghỉ thôi.');
  await expect(hero).toContainText(/Thẻ tiếp theo đến hạn ngày \d+\/\d+\./);
  await expect(hero.getByRole('link')).toHaveCount(0);
});

test('with nothing due and nothing studied, the lead area does not praise', async ({ page }) => {
  seedDue(3, { later: true });
  await logIn(page);
  const hero = page.getByRole('region', { name: 'Hôm nay' });
  await expect(hero).toContainText('Chưa có thẻ nào đến hạn.');
  await expect(hero).not.toContainText('Xong hết hôm nay');
});

test('Phân tích keeps its old page at /analytics', async ({ page }) => {
  seedDue(3);
  await logIn(page);
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Phân tích', level: 1 })).toBeVisible();
});
