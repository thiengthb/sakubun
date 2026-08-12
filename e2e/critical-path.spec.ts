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
  // A per-test budget above the 60s default (config), because this ONE test keeps being the gate's only
  // red and the failure is always the same shape: `locator.fill` on the login form times out while the
  // app itself is fine — 6.6s standalone, >60s in a full-suite run, on identical code (measured
  // 2026-08-12, and the same signature as issue #7). It walks the two heaviest first-compile routes
  // (/login then the authed dashboard) right after warmup, so a cold Turbopack compile lands inside its
  // budget instead of beside it.
  //
  // This does NOT weaken any assertion: `expect` keeps its own 10s timeout, so a genuinely broken login
  // still fails — it just fails on the assertion instead of on a stopwatch. What it buys is that a slow
  // compile stops being REPORTED as a broken app. If this test ever goes red again, read the failure
  // shape first: an assertion message is a real bug, a `fill`/`goto` timeout is this again.
  test.setTimeout(180_000);
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // A fresh account has no items, so the authed dashboard shows the empty-state prompt.
  await expect(page.getByText('Chưa có gì để học')).toBeVisible();
  // Measured 2026-08-12: an empty store short-circuits to THIS state — no tabs, no charts at all. So the
  // empty-chart message lives in `lib/chart-empty.ts` with unit tests, not in an e2e assertion here.

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

// A slider whose NUMBER is an index must announce the WORD the screen shows.
//
// Measured on production 2026-08-12: «Cỡ câu» carried `aria-valuenow="1"` on a 0..6 scale while the label
// under the thumb read «Ngắn» — so assistive tech got a position where the learner reads a word. The
// Slider wrapper's own docblock justified having no `aria-valuetext` with "the value is already announced
// via aria-valuenow", which is true of the difficulty scale (3 of 5 means something) and false of an
// index. Pinned here rather than in a unit test because `aria-valuenow` is only populated after Radix
// hydrates — and that is the same property that made the first measurement of this read `null` (see the
// hidden-tab trap in e2e/no-js-first-paint.spec.ts).
test('slider «Cỡ câu» đọc ra CHỮ, không phải chỉ số', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings');
  const size = page.getByRole('slider', { name: 'Cỡ câu' });
  await expect(size).toBeVisible();
  // Hydrated → the numeric position is there…
  await expect(size).toHaveAttribute('aria-valuenow', /\d+/);
  // …and next to it, the word. Default sentenceSize is "medium" → «Vừa».
  await expect(size).toHaveAttribute('aria-valuetext', 'Vừa');

  // The difficulty slider deliberately has NO valuetext: 3 of 5 already means what it says, and a
  // redundant one only makes the announcement longer.
  const difficulty = page.getByRole('slider', { name: 'Độ phức tạp của câu' });
  await expect(difficulty).toHaveAttribute('aria-valuenow', /\d+/);
  expect(await difficulty.getAttribute('aria-valuetext')).toBeNull();
});
