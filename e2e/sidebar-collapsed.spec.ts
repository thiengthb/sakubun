import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// thien, 7.4: folded to icons, every sidebar item's icon sits in the middle of its button (the
// 2px border of the active item used to push them right).

test.beforeAll(async () => {
  await seedE2eAccount();
});

test('the folded sidebar centres every icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.locator('[data-sidebar="trigger"]').first().click();
  await expect(page.locator('[data-collapsible="icon"]').first()).toBeAttached();

  const buttons = page.locator('[data-sidebar="menu-button"]');
  await expect(buttons.first()).toBeVisible();
  // Wait for the fold to finish: the buttons shrink to 32px.
  await expect.poll(async () => (await buttons.first().boundingBox())?.width).toBe(32);
  const offsets = await buttons.evaluateAll((els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      const icon = el.querySelector('svg')!.getBoundingClientRect();
      return {
        x: icon.left + icon.width / 2 - (box.left + box.width / 2),
        y: icon.top + icon.height / 2 - (box.top + box.height / 2),
      };
    }),
  );
  expect(offsets.length).toBeGreaterThan(3);
  for (const { x, y } of offsets) {
    expect(Math.abs(x)).toBeLessThan(0.5);
    expect(Math.abs(y)).toBeLessThan(0.5);
  }
});

async function logIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

// UI v2, phase 1: the sidebar moved to Base UI. Only the current page's item carries data-active,
// so only it gets the raised look.
test('only the current page is marked active in the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);
  await page.goto('/settings');
  const nav = page.locator('[data-sidebar="menu-button"]');
  await expect(nav.first()).toBeVisible();
  await expect(page.locator('[data-sidebar="menu-button"][data-active]')).toHaveCount(1);
  await expect(page.locator('[data-sidebar="menu-button"][data-active]')).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('[data-sidebar="menu-button"][data-active]')).toHaveText('Cài đặt');
});

// On a phone the sidebar is a sheet: a tap on a link opens the page and closes the sheet.
test('a link in the phone sidebar closes the sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page);
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Mở menu' }).first().click();
  const sheet = page.locator('[data-mobile="true"][data-sidebar="sidebar"]');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('link', { name: 'Hội thoại' }).click();
  await page.waitForURL((u) => u.pathname === '/kaiwa');
  await expect(sheet).toBeHidden();
});
