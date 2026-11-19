import path from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { pathPoints, STROKE_BOX } from '@/lib/japanese/strokes';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// KD2 (docs/plans/2026-11-19-kanji-draw-search.md): the pen in Kho's search box opens a
// drawing pad, dropping down under the box on a laptop and a keyboard at the foot of a phone; a kanji drawn there is
// guessed, and a tap on the guess puts it in the box, which searches it.

const TABLE = JSON.parse(
  readFileSync(path.join(process.cwd(), 'data/kanji/strokes.json'), 'utf8'),
) as Record<string, string[]>;

/** Draws `kanji` on the pad stroke by stroke, as KanjiVG writes it. */
async function draw(page: Page, kanji: string) {
  const pad = page.locator('[data-slot="kanji-draw"]');
  const box = (await pad.boundingBox())!;
  const at = (p: { x: number; y: number }) => ({
    x: box.x + (p.x / STROKE_BOX) * box.width,
    y: box.y + (p.y / STROKE_BOX) * box.height,
  });
  for (const [n, d] of TABLE[kanji].entries()) {
    const [first, ...rest] = pathPoints(d).map(at);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    for (const p of rest) await page.mouse.move(p.x, p.y, { steps: 2 });
    await page.mouse.up();
    await expect(pad).toHaveAttribute('data-strokes', String(n + 1));
  }
}

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
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
};

test.beforeAll(async () => {
  await seedE2eAccount();
});

test('on a laptop, a kanji drawn in the pad under the box is searched (1440px)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/resources', { waitUntil: 'networkidle' });
  const box = page.getByRole('searchbox', { name: 'Tìm trong kho và Kho chung' });

  await page.getByRole('button', { name: 'Vẽ chữ kanji' }).click();
  const pad = page.getByRole('dialog', { name: 'Vẽ chữ' });
  await expect(pad).toBeVisible();
  // The board stays under the pad.
  await expect(page.getByRole('heading', { level: 2, name: /^N5/ })).toBeVisible();

  await draw(page, '会');
  await expect(pad.getByRole('button', { name: 'Thêm 会' })).toBeVisible();
  await shot(page, 've-kanji-laptop');
  await pad.getByRole('button', { name: 'Thêm 会' }).click();
  await expect(box).toHaveValue('会');
  await page.waitForURL(/\/resources\?q=%E4%BC%9A$/);
  await expect(page.getByRole('region', { name: /^Trong Kho chung/ })).toBeVisible();
  // The pad is empty again for the next kanji, and the next one is added after the first.
  await expect(page.locator('[data-slot="kanji-draw"]')).toHaveAttribute('data-strokes', '0');
  await draw(page, '話');
  await pad.getByRole('button', { name: 'Thêm 話' }).click();
  await expect(box).toHaveValue('会話');
  await page.waitForURL(/\/resources\?q=%E4%BC%9A%E8%A9%B1$/);
  await shot(page, 've-kanji-laptop-ket-qua');

  // Xoá nét takes back the last stroke; Xoá hết empties the pad.
  await draw(page, '日');
  await pad.getByRole('button', { name: 'Xoá nét' }).click();
  await expect(page.locator('[data-slot="kanji-draw"]')).toHaveAttribute('data-strokes', '3');
  await pad.getByRole('button', { name: 'Xoá hết' }).click();
  await expect(page.locator('[data-slot="kanji-draw"]')).toHaveAttribute('data-strokes', '0');

  await page.getByRole('button', { name: 'Đóng khung vẽ' }).click();
  await expect(pad).toHaveCount(0);
  // The box's own clear button sits beside the pen, not under it.
  await page.getByRole('button', { name: 'Xoá nội dung' }).click();
  await expect(box).toHaveValue('');
  await page.waitForURL(/\/resources$/);
});

test("on a phone, the drawing keyboard takes the tab bar's place (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/resources', { waitUntil: 'networkidle' });
  const box = page.getByRole('searchbox', { name: 'Tìm trong kho và Kho chung' });
  await shot(page, 've-kanji-phone-truoc');

  await page.getByRole('button', { name: 'Vẽ chữ kanji' }).click();
  const keyboard = page.getByRole('region', { name: 'Bàn phím vẽ' });
  await expect(keyboard).toBeVisible();
  // It sits at the foot of the screen, over the tab bar.
  const bottom = (await keyboard.boundingBox())!;
  expect(bottom.y + bottom.height).toBeGreaterThanOrEqual(843);

  await draw(page, '会');
  await keyboard.getByRole('button', { name: 'Thêm 会' }).click();
  await expect(box).toHaveValue('会');
  await page.waitForURL(/\/resources\?q=%E4%BC%9A$/);
  await draw(page, '社');
  await shot(page, 've-kanji-phone');

  // Bàn phím goes back to typing.
  await keyboard.getByRole('button', { name: 'Bàn phím' }).click();
  await expect(keyboard).toHaveCount(0);
  await expect(box).toBeFocused();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
});
