import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// thien, 2026-10-25: the dark-mode switch is Duolingo's: a thick track with the 2px control edge
// and a lip, a plain knob with no icon in it.

test.beforeAll(async () => {
  await seedE2eAccount();
});

test('the dark-mode switch is raised and flips the theme', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  const sw = page.getByRole('switch', { name: 'Bật/tắt giao diện tối' });
  await expect(sw).toBeVisible();
  const look = await sw.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { edge: cs.borderTopWidth, lip: cs.boxShadow, h: el.getBoundingClientRect().height };
  });
  expect(look.edge).toBe('2px');
  expect(look.lip).toMatch(/0px 2px 0px/);
  expect(look.h).toBe(28);
  await expect(sw.locator('svg')).toHaveCount(0);

  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await sw.click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
    .toBe(!before);
});
