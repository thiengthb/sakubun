import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// KJ2 (docs/plans/2026-11-08-kanji.md): Tài nguyên › Kanji lists the 2,136 Jōyō kanji as tiles,
// easiest level first, with a level filter and a search; a tile opens the kanji's details.

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

const shot = async (page: Page, name: string) => {
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
};

test.beforeEach(async () => {
  await seedE2eAccount();
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`Kanji tab: tiles, level filter, search and the detail dialog (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/resources', { waitUntil: 'networkidle' });
    await shot(page, `tai-nguyen-${width}`);

    await page.getByRole('tab', { name: 'Kanji' }).click();
    await expect(page).toHaveURL(/tab=kanji/);
    await expect(page.getByText('2.136 chữ Jōyō')).toBeVisible();
    const tiles = page.locator('[data-slot="kanji-tile"]');
    await expect(tiles).toHaveCount(120);
    // Nothing to add here: the list is the Jōyō list.
    await expect(page.getByRole('button', { name: 'Thêm' })).toHaveCount(0);
    await shot(page, `tai-nguyen-kanji-${width}`);

    // More tiles come as the list scrolls.
    await tiles.last().scrollIntoViewIfNeeded();
    await expect(tiles).toHaveCount(240);

    await page.getByRole('radio', { name: 'N1' }).click();
    await expect(tiles.first()).toBeVisible();
    await page.getByRole('searchbox', { name: 'Tìm kanji' }).fill('kinh');
    await page.getByRole('radio', { name: 'Mọi cấp' }).click();
    await expect(tiles.filter({ hasText: '経' })).toHaveCount(1);
    await tiles.filter({ hasText: '経' }).getByRole('button').click();
    const dialog = page.getByRole('dialog', { name: '経 [KINH]' });
    await expect(dialog).toContainText('Âm On');
    await expect(dialog).toContainText('ケイ');
    await expect(dialog).toContainText('Bộ');
    await page.waitForTimeout(300);
    await shot(page, `tai-nguyen-kanji-chi-tiet-${width}`);
    await page.keyboard.press('Escape');

    await page.getByRole('searchbox', { name: 'Tìm kanji' }).fill('経済');
    await expect(tiles).toHaveCount(2);
    await page.getByRole('searchbox', { name: 'Tìm kanji' }).fill('không có chữ này');
    await expect(page.getByText('Không có chữ nào khớp')).toBeVisible();
  });
}
