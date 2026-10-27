import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// docs/ui-standard.md › Đầu trang: on a phone the menu logo, the title block and the page's actions
// share ONE 36px row. Each step-6 page PR adds its page here. A page with the detail header (a lot
// to say about one thing) is the exception: its row holds the logo, the trail and the star, and the
// title gets a line of its own under it (thien, item detail round 2).
const TEMPLATE_PAGES = [
  '/',
  '/settings',
  '/resources',
  '/resources/new?kind=grammar',
  '/resources/ph-item/edit',
  '/groups/new',
];
const DETAIL_PAGES = ['/resources/ph-item'];

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    db.prepare(
      `INSERT OR REPLACE INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt)
       VALUES (${E2E_OWNER}, 'ph-item', 'GRAMMAR', '〜ばかりに', NULL, NULL, 'chỉ vì', 'N2', NULL, 'MCP', NULL, 0, 0, ?)`,
    ).run(new Date().toISOString().replace('Z', '+00:00'));
  } finally {
    db.close();
  }
});

async function login(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test('detail headers keep logo, trail and star on one row, the title under it, at 390px', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);
  const wrong: string[] = [];
  for (const path of DETAIL_PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => {
      const shell = document.querySelector('[data-template]');
      const logo = shell?.querySelector('header button[aria-label="Mở menu"]');
      const rowEl = logo?.parentElement?.parentElement;
      const h1 = shell?.querySelector('header h1');
      // The middle child holds the trail; it must render something.
      const trail = rowEl?.children[1]?.firstElementChild;
      const icons = rowEl?.lastElementChild;
      if (!logo || !rowEl || !h1) return null;
      const box = (el: Element | null | undefined) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
      };
      return {
        row: box(rowEl)!,
        logo: box(logo)!,
        h1: box(h1)!,
        trail: box(trail),
        icons: box(icons),
      };
    });
    if (!m) {
      wrong.push(`${path}: no detail header (data-template, menu logo, h1)`);
      continue;
    }
    if (m.logo.h !== 36) wrong.push(`${path}: logo is ${m.logo.h}px, not 36px`);
    if (m.row.h !== 36) wrong.push(`${path}: top row is ${m.row.h}px, not 36px`);
    if (!m.trail) wrong.push(`${path}: no trail in the top row`);
    for (const el of [m.trail, m.icons]) {
      if (el && (el.top < m.row.top || el.bottom > m.row.bottom))
        wrong.push(
          `${path}: an element at ${el.top}-${el.bottom} leaves the row ${m.row.top}-${m.row.bottom}`,
        );
    }
    if (m.h1.top < m.row.bottom) wrong.push(`${path}: the title starts inside the top row`);
  }
  expect(wrong, wrong.join('\n')).toEqual([]);
});

test('template pages keep logo, title and actions on one row at 390px', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);

  const wrong: string[] = [];
  for (const path of TEMPLATE_PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const row = await page.evaluate(() => {
      const shell = document.querySelector('[data-template]');
      const logo = shell?.querySelector('header button[aria-label="Mở menu"]');
      const h1 = shell?.querySelector('header h1');
      const rowEl = logo?.parentElement?.parentElement;
      if (!logo || !h1 || !rowEl) return null;
      const mid = (el: Element) => {
        const r = el.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height),
        };
      };
      // A page with actionsOnPhone="split" hides the row's copy of its actions on a phone.
      const actions = [...rowEl.querySelectorAll(':scope > div:not(:first-child) button')]
        .filter((el) => el.getBoundingClientRect().height > 0)
        .map(mid);
      return { row: mid(rowEl), logo: mid(logo), h1: mid(h1), actions };
    });
    if (!row) {
      wrong.push(`${path}: no template header (data-template, menu logo, h1)`);
      continue;
    }
    if (row.logo.height !== 36) wrong.push(`${path}: logo is ${row.logo.height}px, not 36px`);
    if (row.row.height > 44) wrong.push(`${path}: header row is ${row.row.height}px, not one row`);
    for (const el of [row.h1, ...row.actions]) {
      if (el.top < row.row.top || el.bottom > row.row.bottom)
        wrong.push(
          `${path}: an element at ${el.top}-${el.bottom} leaves the row ${row.row.top}-${row.row.bottom}`,
        );
    }
  }
  expect(wrong, wrong.join('\n')).toEqual([]);
});
