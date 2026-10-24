import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// docs/ui-standard.md: buttons and fields are 36px tall on a phone and 28px from 768px. The unit
// tests read class names; this measures what the browser actually draws, so a caller's className
// that overrides the height shows up here.

const PAGES = ['/settings', '/settings?tab=data', '/resources?tab=grammar', '/groups/new'];

const CONTROLS = [
  'button[data-slot="button"][data-size="default"]',
  'a[data-slot="button"][data-size="default"]',
  'button[data-slot="button"][data-size="icon"]',
  'button[data-slot="select-trigger"][data-size="default"]',
  'button[data-slot="toggle-group-item"][data-size="default"]',
  // The stepper's number field sits inside its 2px frame; the frame is the control.
  'input[data-slot="input"]:not([data-slot="stepper"] *)',
  '[data-slot="stepper"]',
].join(',');

test.beforeAll(async () => {
  await seedE2eAccount();
});

for (const [width, px] of [
  [390, 36],
  [1440, 28],
] as const) {
  test(`controls are ${px}px tall at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

    const wrong: string[] = [];
    let measured = 0;
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' });
      const sizes = await page.evaluate((selector) => {
        return [...document.querySelectorAll<HTMLElement>(selector)]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({
            what: `${el.dataset.slot} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`,
            height: Math.round(el.getBoundingClientRect().height),
          }));
      }, CONTROLS);
      measured += sizes.length;
      for (const s of sizes) if (s.height !== px) wrong.push(`${path}  ${s.what}: ${s.height}px`);
    }

    expect(
      measured,
      'no control found: the selectors no longer match the components',
    ).toBeGreaterThan(10);
    expect(wrong, `Controls must be ${px}px tall at ${width}px:\n${wrong.join('\n')}`).toEqual([]);
  });
}
