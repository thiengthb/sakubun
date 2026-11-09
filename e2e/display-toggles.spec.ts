import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// UI v2, phase 1 (docs/plans/2026-11-08-ui-v2.md › Khung điều hướng): the user block at the foot of
// the sidebar opens one menu with Cài đặt, the dark theme, furigana and Đăng xuất; the loose あ and
// sun toggles are gone. Furigana is the learner's setting, kept on the server.

test.beforeAll(async () => {
  await seedE2eAccount();
});

async function logIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test('the user menu switches the theme and furigana', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);

  // The loose toggles left the sidebar.
  await expect(page.getByRole('button', { name: /^Chuyển sang giao diện/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /furigana$/ })).toHaveCount(0);

  const account = page.getByRole('button', { name: /^Tài khoản:/ });
  // The block keeps sakubun's button language: a 2px edge and a 2px lip.
  const look = await account.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { edge: cs.borderTopWidth, lip: cs.boxShadow };
  });
  expect(look.edge).toBe('2px');
  expect(look.lip).toMatch(/0px 2px 0px/);

  await account.click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['Cài đặt', 'Đăng xuất']);
  await expect(menu.getByRole('menuitemcheckbox')).toHaveCount(2);
  for (const name of ['Giao diện tối', 'Hiện furigana'])
    await expect(menu.getByRole('menuitemcheckbox', { name, exact: true })).toBeVisible();

  // The theme flips and the menu stays open for the next switch.
  const theme = menu.getByRole('menuitemcheckbox', { name: 'Giao diện tối' });
  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await expect(theme).toHaveAttribute('aria-checked', String(before));
  await theme.click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
    .toBe(!before);
  await expect(theme).toHaveAttribute('aria-checked', String(!before));

  // Furigana is on for a new learner; off survives a reload, and on again restores it.
  const furigana = menu.getByRole('menuitemcheckbox', { name: 'Hiện furigana' });
  await expect(furigana).toHaveAttribute('aria-checked', 'true');
  await furigana.click();
  await expect(furigana).toHaveAttribute('aria-checked', 'false');
  await expect(furigana).not.toHaveAttribute('aria-disabled', 'true');
  await page.reload();
  await account.click();
  await expect(furigana).toHaveAttribute('aria-checked', 'false');
  await furigana.click();
  await expect(furigana).not.toHaveAttribute('aria-disabled', 'true');
  await page.reload();
  await account.click();
  await expect(furigana).toHaveAttribute('aria-checked', 'true');

  // Cài đặt goes to the page and closes the menu.
  await menu.getByRole('menuitem', { name: 'Cài đặt' }).click();
  await page.waitForURL((u) => u.pathname === '/settings');
  await expect(menu).toBeHidden();
});

test('folded, the user menu opens beside the avatar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);
  await page.locator('[data-sidebar="trigger"]').first().click();
  await expect(page.locator('[data-collapsible="icon"]').first()).toBeAttached();
  const account = page.getByRole('button', { name: /^Tài khoản:/ });
  await expect.poll(async () => (await account.boundingBox())?.width).toBe(32);
  // In dev the Next.js badge sits over the bottom-left corner, so open it from the keyboard.
  await account.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  // Polled: the menu zooms in and the sidebar may still be settling, so both boxes are read
  // afresh until they agree.
  await expect
    .poll(
      async () => {
        const a = (await account.boundingBox())!;
        const m = (await menu.boundingBox())!;
        return m.x - (a.x + a.width);
      },
      { message: 'the menu opens to the right of the folded sidebar' },
    )
    .toBeGreaterThanOrEqual(0);
});

test('Đăng xuất in the user menu signs out', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);
  await page.getByRole('button', { name: /^Tài khoản:/ }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/settings');
  await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 30_000 });
});

// On a phone the user menu sits in the sidebar sheet: Cài đặt opens the page and closes both.
test("Cài đặt in the phone sheet's user menu closes the sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page);
  await page.goto('/library', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Mở menu' }).first().click();
  const sheet = page.locator('[data-mobile="true"][data-sidebar="sidebar"]');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /^Tài khoản:/ }).click();
  await page.getByRole('menuitem', { name: 'Cài đặt' }).click();
  await page.waitForURL((u) => u.pathname === '/settings');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(sheet).toBeHidden();
});
