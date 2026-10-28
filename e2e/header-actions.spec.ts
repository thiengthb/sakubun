import { expect, test, type Locator, type Page } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// thien, 7.4: on a laptop a header action is its icon and opens to its word on hover; on a phone an
// icon anyone reads (filter, sort, add...) stands alone and any other keeps its word. The page's
// primary (orange) action always shows its word.

test.beforeAll(async () => {
  await seedE2eAccount();
});

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

/** How wide the button's word is drawn (0 when folded or hidden). */
const wordWidth = (button: Locator) =>
  button.evaluate((el) => {
    const word = [...el.querySelectorAll('span')].find((s) => s.textContent?.trim());
    return word ? Math.round(word.getBoundingClientRect().width) : 0;
  });

test('header actions fold to icons on a laptop and open on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/kaiwa');
  const ai = page.getByRole('button', { name: 'Soạn với AI' });
  const add = page.getByRole('link', { name: 'Thêm' });
  await expect(ai).toBeVisible();
  await page.mouse.move(700, 600);
  await expect.poll(() => wordWidth(ai)).toBe(0);
  await ai.hover();
  await expect.poll(() => wordWidth(ai)).toBeGreaterThan(20);
  expect(await wordWidth(add)).toBeGreaterThan(20);
});

test('on a phone only an unusual icon keeps its word', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/kaiwa');
  await expect
    .poll(() => wordWidth(page.getByRole('button', { name: 'Soạn với AI' })))
    .toBeGreaterThan(20);
  expect(await wordWidth(page.getByRole('link', { name: 'Thêm' }))).toBeGreaterThan(20);

  await page.goto('/resources');
  const filter = page.getByRole('button', { name: /^Bộ lọc/ }).first();
  const sort = page.getByRole('button', { name: /^Sắp xếp/ }).first();
  await expect(filter).toBeVisible();
  expect(await wordWidth(filter)).toBe(0);
  expect(await wordWidth(sort)).toBe(0);
  // Folded to icons, the toolbar fits the phone: nothing pokes past the right edge.
  for (const b of [filter, sort]) {
    const box = (await b.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(390 - 16 + 0.5);
  }
});
