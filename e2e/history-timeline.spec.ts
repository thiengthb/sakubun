import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// Lịch sử as a timeline (thien, 7.4 History B, Detail B): turns grouped under their day, a side
// panel that keeps the list in sight and steps through it with the arrow keys, and readings shown
// without a hover while furigana is on.

const DAY = 24 * 3_600_000;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

function seed() {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  for (const t of ['ReviewLog', 'Turn', 'Sentence', 'SrsState', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const insert = db.prepare(
    `INSERT INTO Sentence (userId, id, direction, exerciseType, sourceText, sourceRuby, suggested,
       userAnswer, score, createdAt, starred, status)
     VALUES (${E2E_OWNER}, ?, 'JA_VI', 'TRANSLATION', ?, ?, ?, ?, ?, ?, 0, 'GRADED')`,
  );
  const now = Date.now();
  insert.run(
    'a',
    '音楽を聞きます。',
    '音楽[おんがく]を聞[き]きます。',
    'Tôi nghe nhạc.',
    'Nghe nhạc.',
    90,
    new Date(now - 60_000).toISOString(),
  );
  insert.run(
    'b',
    '駅まで歩きます。',
    '駅[えき]まで歩[ある]きます。',
    'Tôi đi bộ đến ga.',
    'Đi đến ga.',
    40,
    new Date(now - 120_000).toISOString(),
  );
  insert.run(
    'c',
    '雨が降ります。',
    '雨[あめ]が降[ふ]ります。',
    'Trời mưa.',
    'Mưa.',
    75,
    new Date(now - DAY - 60_000).toISOString(),
  );
  db.close();
}

test('Lịch sử groups turns by day, and the side panel steps through them with the arrow keys', async ({
  page,
}) => {
  await seedE2eAccount();
  seed();
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/history', { waitUntil: 'networkidle' });

  const days = page.locator('[data-slot="history-day"]');
  await expect(days).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Hôm nay', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hôm qua', exact: true })).toBeVisible();
  await expect(days.nth(0).locator('[data-history-row]')).toHaveCount(2);
  await expect(page.getByText('2 lượt · 1 Good trở lên')).toBeVisible();

  const rows = page.locator('[data-history-row]');
  await rows.filter({ hasText: 'Nghe nhạc.' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByText('1 / 3')).toBeVisible();
  await expect(panel.getByText('Tôi nghe nhạc.')).toBeVisible();
  await expect(rows.filter({ hasText: 'Nghe nhạc.' })).toHaveAttribute('aria-current', 'true');

  // The panel leaves the list in sight: the open row's result is not under it.
  const panelLeft = (await panel.boundingBox())!.x;
  const pill = (await rows.filter({ hasText: 'Nghe nhạc.' }).getByText('90').boundingBox())!;
  expect(pill.x + pill.width).toBeLessThan(panelLeft);

  await page.keyboard.press('ArrowRight');
  await expect(panel.getByText('2 / 3')).toBeVisible();
  await expect(panel.getByText('Tôi đi bộ đến ga.')).toBeVisible();
  await panel.getByRole('button', { name: 'Lượt sau' }).click();
  await expect(panel.getByText('3 / 3')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Lượt sau' })).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await expect(panel.getByText('2 / 3')).toBeVisible();

  // A click on another row shows that turn in the same panel.
  await rows.filter({ hasText: 'Mưa.' }).click();
  await expect(panel.getByText('3 / 3')).toBeVisible();
  await expect(panel.getByText('Trời mưa.')).toBeVisible();

  await panel.getByRole('button', { name: 'Đóng' }).click();
  await expect(panel).toHaveCount(0);
});

test('with furigana on, Lịch sử shows the readings without a hover, in the panel too', async ({
  page,
}) => {
  await seedE2eAccount();
  seed();
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/history', { waitUntil: 'networkidle' });

  const reading = (scope: string) =>
    page
      .locator(`${scope} rt`)
      .filter({ hasText: 'おんがく' })
      .first()
      .evaluate((rt) => getComputedStyle(rt).visibility);
  const toggle = page.getByRole('button', { name: /furigana$/ });
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await expect.poll(() => reading('main [data-history-row]')).toBe('visible');

  await page.locator('[data-history-row]').filter({ hasText: 'Nghe nhạc.' }).click();
  await expect.poll(() => reading('[role="dialog"]')).toBe('visible');
});
