import { expect, test, type Page } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

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
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
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
