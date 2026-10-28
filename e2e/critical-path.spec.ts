import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

test.beforeAll(seedE2eAccount);

test('login → dashboard → a settings change persists across reload', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // Lands on Phân tích. Its body depends on what other specs left in the shared e2e DB (empty
  // store or charts), so the check is the page itself, not one of its states.
  await page.waitForURL((u) => u.pathname === '/', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Phân tích', level: 1 })).toBeVisible();

  await page.goto('/settings');
  // Nội dung + Nhịp học + Nghe & nói are one "Luyện tập" tab now, and it is the default — the daily
  // cap is reachable without touching the tab rail.
  await expect(page.getByRole('tab', { name: 'Luyện tập' })).toHaveAttribute(
    'data-state',
    'active',
  );
  await page.getByRole('textbox', { name: 'Mẫu ngữ pháp mới / ngày', exact: true }).fill('11');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Mọi thay đổi đã được lưu')).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Mẫu ngữ pháp mới / ngày', exact: true }),
  ).toHaveValue('11');
});

test('Luyện tập shows only the eight settings; sentence-shape fields are gone', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings');
  await expect(
    page.getByRole('textbox', { name: 'Từ vựng mới / ngày', exact: true }),
  ).toBeVisible();
  const rates = page.getByRole('radiogroup', { name: 'Tốc độ đọc' });
  await expect(rates).toBeVisible();
  await expect(rates.getByRole('radio')).toHaveText(['0.5×', '0.75×', '1×', '1.25×', '1.5×']);
  // Derived from the item since the core rewrite (docs/decisions/0001-core-rewrite.md).
  await expect(page.getByRole('slider', { name: 'Cỡ câu' })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Độ phức tạp của câu' })).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Từ vựng mới / ngày', exact: true }).fill('9');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Mọi thay đổi đã được lưu')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Từ vựng mới / ngày', exact: true })).toHaveValue(
    '9',
  );
});

test('Luyện tập rows: stepper, segmented choice and the folded Nâng cao all save', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings');
  const reviews = page.getByRole('textbox', { name: 'Tối đa lượt ôn / ngày', exact: true });
  const before = Number(await reviews.inputValue());
  await page.getByRole('button', { name: 'Tăng Tối đa lượt ôn / ngày' }).click();
  await expect(reviews).toHaveValue(String(before + 10));

  await page.getByRole('radio', { name: 'Việt → Nhật' }).click();
  await expect(page.getByRole('radio', { name: 'Việt → Nhật' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Nâng cao is folded: its rows are not in the page until the row is opened.
  const retention = page.getByRole('textbox', { name: 'Mục tiêu ghi nhớ (FSRS)', exact: true });
  await expect(retention).toBeHidden();
  await page.getByRole('button', { name: /^Nâng cao/ }).click();
  await expect(retention).toBeVisible();
  await page.getByRole('button', { name: 'Giảm Mục tiêu ghi nhớ (FSRS)' }).click();
  const target = await retention.inputValue();

  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Mọi thay đổi đã được lưu')).toBeVisible();
  await page.reload();

  await expect(
    page.getByRole('textbox', { name: 'Tối đa lượt ôn / ngày', exact: true }),
  ).toHaveValue(String(before + 10));
  await expect(page.getByRole('radio', { name: 'Việt → Nhật' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: /^Nâng cao/ }).click();
  await expect(
    page.getByRole('textbox', { name: 'Mục tiêu ghi nhớ (FSRS)', exact: true }),
  ).toHaveValue(target);
});
