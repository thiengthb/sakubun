import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// Seed the account once the webServer is up (see seedE2eAccount — shared with mobile-layout.spec.ts).
//
// This spec asserts the EMPTY-store dashboard ("Chưa có gì để học"), and mobile-layout.spec.ts seeds
// items into the same throwaway DB. Playwright runs spec files in alphabetical order, and
// `critical-path` sorts before `mobile-layout`, so this one always sees the empty store. Renaming
// either file has to preserve that order.
test.beforeAll(seedE2eAccount);

// The one critical-path smoke: log in with the seeded account, land on the authed dashboard, then prove
// a settings change survives a reload (a real Server Action write + read-back). The MCP-driven part of
// AC-1 ("open a staged sentence") is out of scope for a pure web e2e — a sentence is staged by Claude via
// MCP, not through the web UI — so this covers the web-reachable critical path: auth + a persisted write.
test('login → dashboard → a settings change persists across reload', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // A fresh account has no items, so the authed dashboard shows the empty-state prompt.
  await expect(page.getByText('Chưa có gì để học')).toBeVisible();

  // Change "Mẫu ngữ pháp mới / ngày" (default 3) → 11, save, reload, and assert it stuck.
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Nhịp học' }).click();
  await page.getByLabel('Mẫu ngữ pháp mới / ngày').fill('11');
  await page.getByRole('button', { name: /^(Lưu|Đã lưu)$/ }).click();
  // On a successful save the button flips to the not-dirty "Đã lưu" state.
  await expect(page.getByRole('button', { name: 'Đã lưu' })).toBeVisible();

  await page.reload();
  await page.getByRole('tab', { name: 'Nhịp học' }).click();
  await expect(page.getByLabel('Mẫu ngữ pháp mới / ngày')).toHaveValue('11');
});
