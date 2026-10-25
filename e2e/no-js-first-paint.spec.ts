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

    // Luyện tập keeps one select since Hướng dịch became a segmented choice: Giọng đọc.
    if (path === '/settings') expect(texts.length, 'số ô chọn ở Cài đặt').toBeGreaterThanOrEqual(1);
  }

  expect(empty, 'ô chọn rỗng trong HTML server').toEqual([]);
  // The guard that the scan saw real selects: Cài đặt's one at least. (Cài đặt lost its phone tab
  // select to the underline tabs of the form template; Lịch sử lost its page-size select when it
  // became a card list that loads as it scrolls.)
  expect(total, 'tổng số ô chọn đã kiểm').toBeGreaterThanOrEqual(1);

  await noJs.close();
});

test('chọn giá trị khác thì nhãn trên trigger đổi theo', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings');
  const LABELS = ['Nữ · dễ thương (ずんだもん)', 'Nữ · trong trẻo (四国めたん)'];
  const voice = page.getByRole('combobox', { name: 'Giọng đọc' });
  await expect(voice).toBeVisible();
  const before = ((await voice.textContent()) ?? '').trim();
  const target = LABELS.find((l) => l !== before);
  expect(target, 'phải tìm được một nhãn khác nhãn đang hiện').toBeTruthy();

  await voice.click();
  await page.getByRole('option', { name: target, exact: true }).click();
  await expect(voice).toHaveText(target!);

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Giọng đọc' })).toHaveText(before);
});
