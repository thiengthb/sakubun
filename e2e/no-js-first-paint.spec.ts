import { expect, test, type Browser } from '@playwright/test';
import { E2E_BASE_URL, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

test.beforeAll(seedE2eAccount);

async function noJsPage(browser: Browser) {
  const authed = await browser.newContext({ baseURL: E2E_BASE_URL });
  const page = await authed.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  const storageState = await authed.storageState();
  await authed.close();

  const noJs = await browser.newContext({
    baseURL: E2E_BASE_URL,
    storageState,
    javaScriptEnabled: false,
  });
  return { noJs, page: await noJs.newPage() };
}

test('không có JS, mọi ô chọn trong HTML đầu tiên đã có chữ', async ({ browser }) => {
  const { noJs, page } = await noJsPage(browser);

  const empty: string[] = [];
  let total = 0;

  for (const path of ['/', '/resources', '/history', '/settings']) {
    await page.goto(path);
    const texts = await page.locator('[data-slot="select-value"]').allTextContents();
    total += texts.length;
    texts.forEach((t, i) => {
      if (!t.trim()) empty.push(`${path} → ô chọn thứ ${i + 1}`);
    });

    if (path === '/settings') expect(texts.length, 'số ô chọn ở Cài đặt').toBeGreaterThanOrEqual(5);
  }

  expect(empty, 'ô chọn rỗng trong HTML server').toEqual([]);
  expect(total, 'tổng số ô chọn đã kiểm').toBeGreaterThanOrEqual(6);

  await noJs.close();
});

test('chọn giá trị khác thì nhãn trên trigger đổi theo', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings');
  const LABELS = ['Nhật → Việt', 'Việt → Nhật', 'Song ngữ (đổi chiều từng câu)'];
  const direction = page.getByRole('combobox', { name: 'Hướng dịch' });
  await expect(direction).toBeVisible();
  const before = ((await direction.textContent()) ?? '').trim();
  const target = LABELS.find((l) => l !== before);
  expect(target, 'phải tìm được một nhãn khác nhãn đang hiện').toBeTruthy();

  await direction.click();
  await page.getByRole('option', { name: target, exact: true }).click();
  await expect(direction).toHaveText(target!);

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Hướng dịch' })).toHaveText(before);
});
