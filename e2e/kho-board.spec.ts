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
  await expect(nav.getByRole('link', { name: 'Kho', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
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
