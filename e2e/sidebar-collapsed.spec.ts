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
