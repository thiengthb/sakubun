import { expect, test, type Page } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// docs/ui-standard.md › Chữ: one weight rule (thien, item detail round 2, 2026-10-25). Text titles
// are 700 (page) and 600 (bold); controls are 500; icons draw at stroke 1.5. Unit tests read the
// tokens and class names; this reads what the browser computes, so a caller's className or an
// icon's own strokeWidth that breaks the rule shows up here.

const PAGES = ['/resources', '/resources?tab=grammar', '/settings', '/groups'];

const CONTROLS = [
  '[data-slot="button"]',
  '[data-slot="badge"]',
  '[data-slot="select-trigger"]',
  '[data-slot="tabs-trigger"]',
  '[data-slot="toggle-group-item"]',
  '[data-sidebar="menu-button"]',
].join(',');

test.beforeAll(async () => {
  await seedE2eAccount();
});

async function login(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test('controls are 500, page titles 700, icons stroke 1.5', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  const wrong: string[] = [];
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const found = await page.evaluate((selector) => {
      const out: string[] = [];
      const name = (el: Element) =>
        `${el.getAttribute('data-slot') ?? el.getAttribute('data-sidebar')} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      for (const el of document.querySelectorAll(selector)) {
        const w = getComputedStyle(el).fontWeight;
        if (w !== '500') out.push(`${name(el)} weight ${w}`);
      }
      for (const h of document.querySelectorAll('h1')) {
        const w = getComputedStyle(h).fontWeight;
        if (w !== '700') out.push(`h1 "${h.textContent?.trim()}" weight ${w}`);
      }
      for (const svg of document.querySelectorAll('svg.lucide')) {
        const s = svg.getAttribute('stroke-width');
        if (s !== '1.5') out.push(`icon ${svg.getAttribute('class')} stroke ${s}`);
      }
      return out;
    }, CONTROLS);
    wrong.push(...found.map((f) => `${path}: ${f}`));
  }
  expect(wrong).toEqual([]);
});
