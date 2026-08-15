import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

test.beforeAll(seedE2eAccount);

test('login → dashboard → a settings change persists across reload', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByText('Chưa có gì để học')).toBeVisible();

  await page.goto('/settings');
  // Nội dung + Nhịp học + Nghe & nói are one "Luyện tập" tab now, and it is the default — the daily
  // cap is reachable without touching the tab rail.
  await expect(page.getByRole('tab', { name: 'Luyện tập' })).toHaveAttribute(
    'data-state',
    'active',
  );
  await page.getByLabel('Mẫu ngữ pháp mới / ngày').fill('11');
  await page.getByRole('button', { name: /^(Lưu|Đã lưu)$/ }).click();
  await expect(page.getByRole('button', { name: 'Đã lưu' })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Mẫu ngữ pháp mới / ngày')).toHaveValue('11');
});

test('slider «Cỡ câu» đọc ra CHỮ, không phải chỉ số', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings');
  const size = page.getByRole('slider', { name: 'Cỡ câu' });
  await expect(size).toBeVisible();
  await expect(size).toHaveAttribute('aria-valuenow', /\d+/);
  await expect(size).toHaveAttribute('aria-valuetext', 'Vừa');

  const difficulty = page.getByRole('slider', { name: 'Độ phức tạp của câu' });
  await expect(difficulty).toHaveAttribute('aria-valuenow', /\d+/);
  expect(await difficulty.getAttribute('aria-valuetext')).toBeNull();
});
