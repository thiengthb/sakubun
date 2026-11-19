import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// U4b (docs/plans/2026-11-14-u4-kho.md): Kho opens on the JLPT levels, the menu has one Kho, and
// links written for the old list of every item land on /resources/all.

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.beforeAll(async () => {
  await seedE2eAccount();
});

// Runs after a failed test too, so specs after this file never see what U4d's test took.
test.afterAll(async () => {
  await dropTakenN1Grammar();
});

test('Kho is the level board, from N5 to N1 and outside JLPT', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/resources');
  await expect(page.getByRole('heading', { level: 1, name: 'Kho' })).toBeVisible();
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1', 'Ngoài JLPT'])
    await expect(
      page.getByRole('heading', { level: 2, name: new RegExp(`^${level}`) }),
    ).toBeVisible();
  // Every kind of every level has a bar the screen reader can read.
  await expect(page.getByRole('progressbar')).toHaveCount(15);

  // One Kho in the menu; it stays lit on Kho chung.
  // At 1440px the phone tab bar is hidden, so the sidebar's links are the only menu links.
  const nav = page;
  await expect(nav.getByRole('link', { name: 'Kho', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Kho chung', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Tài nguyên', exact: true })).toHaveCount(0);

  // A cell opens that level's screen (U4c2), Kho still lit.
  const n4 = page.getByRole('region', { name: /^N4/ });
  await n4.getByRole('link', { name: /Từ vựng/ }).click();
  await page.waitForURL(/\/resources\/level\/N4\/vocab$/);
  await expect(page.getByRole('heading', { level: 1, name: 'N4 · Từ vựng' })).toBeVisible();
  // Scoped to the sidebar: the breadcrumb has a "Kho" link too.
  await expect(
    page.locator('[data-sidebar="sidebar"]').getByRole('link', { name: 'Kho', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('a set card opens the set: its words, one open beside them, the sets around it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/resources/level/N4/vocab');
  // The whole card is the link (U4c3); its name is the set's title.
  await page.getByRole('link', { name: 'Chặng 1', exact: true }).click();
  await page.waitForURL(/\/resources\/level\/N4\/vocab\/1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Chặng 1' })).toBeVisible();

  const map = page.getByRole('list', { name: 'Các mục của chặng' });
  await expect(map.getByRole('button')).toHaveCount(20);
  const panel = page.getByRole('complementary', { name: 'Mục đang mở' });
  const third = map.getByRole('button').nth(2);
  const word = (await third.locator('[lang="ja"]').textContent())!;
  await third.click();
  await expect(third).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByText(word, { exact: true })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Chặng trước' })).toBeDisabled();
  await page.getByRole('link', { name: 'Chặng sau' }).click();
  await page.waitForURL(/\/resources\/level\/N4\/vocab\/2$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Chặng 2' })).toBeVisible();

  // A set the level does not have is not found.
  // The page streams behind its skeleton, so the status is 200; the page says it.
  await page.goto('/resources/level/N4/vocab/999');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
});

test('on a phone a tapped word opens in a sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/resources/level/N5/vocab/1');
  const map = page.getByRole('list', { name: 'Các mục của chặng' });
  const first = map.getByRole('button').first();
  const word = (await first.locator('[lang="ja"]').textContent())!;
  await first.click();
  const sheet = page.getByRole('dialog', { name: word });
  await expect(sheet).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // Widened past md with the sheet open, the sheet closes and the panel beside the map shows the
  // same word.
  await first.click();
  await expect(sheet).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(sheet).toBeHidden();
  // md:hidden alone would hide the sheet too; the overlay going away shows it really closed.
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
  await expect(
    page.getByRole('complementary', { name: 'Mục đang mở' }).getByText(word, { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

test('the level switches between its sets, a tile per word and a list to search', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/resources/level/N5/vocab');
  const tabs = page.getByRole('tablist', { name: 'Chọn cách xem' });
  await expect(tabs.getByRole('tab', { name: 'Chặng' })).toHaveAttribute('aria-selected', 'true');

  // Bản đồ ô: every word of the level, cut by set; the legend filters it.
  await tabs.getByRole('tab', { name: 'Bản đồ ô' }).click();
  await page.waitForURL(/\/resources\/level\/N5\/vocab\?view=map$/);
  await expect(tabs.getByRole('tab', { name: 'Bản đồ ô' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const sets = page.getByRole('region', { name: /^Chặng \d+$/ });
  const total = await sets.count();
  expect(total).toBeGreaterThan(1);
  await expect(
    page.getByRole('list', { name: 'Các mục của chặng 1', exact: true }).getByRole('button'),
  ).toHaveCount(20);
  const filters = page.getByRole('radiogroup', { name: 'Lọc theo trạng thái' });
  await filters.getByRole('radio', { name: /chưa có/i }).click();
  // A filter that hides the open word opens the first word it keeps.
  await expect(
    page
      .getByRole('complementary', { name: 'Mục đang mở' })
      .getByText(/chưa có/i)
      .first(),
  ).toBeVisible();
  const missing = page.locator('[aria-pressed]');
  const shown = await missing.count();
  for (let i = 0; i < Math.min(shown, 5); i++)
    await expect(missing.nth(i)).toContainText('chưa có');
  await filters.getByRole('radio', { name: /tất cả/i }).click();
  await expect(sets).toHaveCount(total);
  const panel = page.getByRole('complementary', { name: 'Mục đang mở' });
  const tile = page
    .getByRole('list', { name: 'Các mục của chặng 2', exact: true })
    .getByRole('button')
    .first();
  const word = (await tile.locator('[lang="ja"]').textContent())!;
  await tile.click();
  await expect(panel.getByText(word, { exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Chặng 2' })).toHaveAttribute(
    'href',
    '/resources/level/N5/vocab/2',
  );

  // Danh sách: one row a word; the search inside the level finds the word just opened.
  await tabs.getByRole('tab', { name: 'Danh sách' }).click();
  await page.waitForURL(/\/resources\/level\/N5\/vocab\?view=list$/);
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByPlaceholder(/Tìm trong N5/).fill(word);
  const row = page.getByRole('row').filter({ hasText: word }).first();
  await expect(row).toBeVisible();
  await expect(row.getByRole('link', { name: 'Chặng 2' })).toHaveAttribute(
    'href',
    '/resources/level/N5/vocab/2',
  );

  // Back to the sets: the plain address again.
  await tabs.getByRole('tab', { name: 'Chặng' }).click();
  await page.waitForURL(/\/resources\/level\/N5\/vocab$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Các chặng' })).toBeVisible();
});

test('on a phone the map filter is one row that scrolls on its own', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/resources/level/N5/vocab?view=map');
  const filters = page.getByRole('radiogroup', { name: 'Lọc theo trạng thái' });
  const radios = filters.getByRole('radio');
  const first = await radios.first().boundingBox();
  const last = await radios.last().boundingBox();
  expect(last!.y).toBe(first!.y);
  await radios.last().click();
  await expect(radios.last()).toHaveAttribute('aria-checked', 'true');
  // The row scrolls, not the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});

test('on a phone a tap on a word in the list opens it, and its speaker does not', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/resources/level/N5/vocab?view=list');
  const link = page.getByRole('link', { name: /^会う: / });
  const href = await link.getAttribute('href');
  const card = page.getByRole('listitem').filter({ has: link });
  // The speaker sits above the card's link: it plays and the page stays.
  await card.getByRole('button', { name: /phát âm/ }).click();
  await expect(page).toHaveURL(/view=list$/);
  // The word itself is under the link, even when it is short and not cut.
  // (A click on the point, as the link above the word is what takes it.)
  const word = (await card.locator('[lang="ja"]', { hasText: '会う' }).first().boundingBox())!;
  await page.mouse.click(word.x + word.width / 2, word.y + word.height / 2);
  await page.waitForURL((u) => u.pathname + u.search === href);
});

test('an old link to a tab lands on the list of every item', async ({ page }) => {
  await signIn(page);
  await page.goto('/resources?tab=vocab');
  await page.waitForURL(/\/resources\/all\?tab=vocab$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mọi mục' })).toBeVisible();

  await page.goto('/resources');
  await page.getByRole('link', { name: 'Mọi mục' }).click();
  await page.waitForURL(/\/resources\/all$/);
});

test('on a phone the board stacks and the Kho tab is lit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/resources');
  await expect(page.getByRole('heading', { level: 2, name: /^N5/ })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

// U4d: what this spec takes in N1 grammar leaves with it, so specs after it see the account as seeded.
async function dropTakenN1Grammar() {
  const { default: Database } = await import('better-sqlite3');
  const { default: path } = await import('node:path');
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  db.pragma('foreign_keys = ON');
  db.prepare(
    `DELETE FROM Item WHERE userId = ${E2E_OWNER} AND kind = 'GRAMMAR' AND level = 'N1' AND source = 'LIBRARY'`,
  ).run();
  db.close();
}

test('a word, a set and the rest of a level are taken in place', async ({ page }) => {
  await dropTakenN1Grammar();
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/resources/level/N1/grammar/1');
  const map = page.getByRole('list', { name: 'Các mục của chặng' });
  const panel = page.getByRole('complementary', { name: 'Mục đang mở' });

  // "Học" on one word: it joins the Kho as a new item, and the panel opens it.
  const first = map.getByRole('button').first();
  const word = (await first.locator('[lang="ja"]').textContent())!;
  await first.click();
  await expect(panel.getByText(/chưa có/i)).toBeVisible();
  await panel.getByRole('button', { name: `Học ${word}` }).click();
  await expect(page.getByText(/Đã thêm 1 mẫu vào kho/)).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Mở mục' })).toBeVisible();

  // The set's button takes the other 19.
  await page.getByRole('button', { name: 'Lấy 19' }).click();
  await expect(page.getByText(/Đã thêm 19 mẫu vào kho/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Lấy \d+$/ })).toHaveCount(0);

  // "Lấy nốt" takes the rest of the level, after asking.
  await page.goto('/resources/level/N1/grammar');
  const lead = page.getByRole('region', { name: 'Bước tiếp theo' });
  const rest = lead.getByRole('button', { name: /Lấy nốt/ });
  const count = Number((await rest.locator('.tabular-nums').textContent())!.trim());
  expect(count).toBeGreaterThan(20);
  await rest.click();
  const ask = page.getByRole('dialog');
  await expect(ask).toContainText(`Lấy ${count} mẫu còn thiếu của N1?`);
  await ask.getByRole('button', { name: `Lấy ${count} mẫu` }).click();
  await expect(page.getByText(new RegExp(`Đã thêm ${count} mẫu vào kho`))).toBeVisible();
  await expect(lead.getByText('đã có đủ cả cấp')).toBeVisible();

  // The board counts them.
  await page.goto('/resources');
  const n1 = page.getByRole('region', { name: /^N1/ });
  // Every N1 pattern taken here (the test starts with none): the whole level, nothing missing.
  const cell = n1.getByRole('link', { name: /Ngữ pháp/ });
  await expect(cell).toContainText(`${count + 20}/${count + 20}`);
  await expect(cell).toContainText('đủ cả cấp');
});
