import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// docs/ui-standard.md › Bố cục: below 1024px a list is cards that load more as you scroll, with no
// pagination; from 1024px it is a table with pages.

const TOTAL = 45;
const GROUPS = 25;

function seed() {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
  const now = Date.now();
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Turn', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    const item = db.prepare(
      `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, source, suspended, starred, createdAt)
       VALUES (?, 'GRAMMAR', ?, NULL, NULL, ?, 'N3', 'MCP', 0, 0, ?)`,
    );
    for (let i = 0; i < TOTAL; i++)
      item.run(`g${i}`, `〜パターン${i + 1}`, `nghĩa ${i + 1}`, iso(now - i * 60_000));
    const group = db.prepare(
      `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
       VALUES (?, ?, 'grammar', NULL, NULL, ?, ?)`,
    );
    for (let i = 0; i < GROUPS; i++)
      group.run(`grp${i}`, `Nhóm ${i + 1}`, iso(now - i * 60_000), iso(now - i * 60_000));
  } finally {
    db.close();
  }
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.beforeAll(async () => {
  await seedE2eAccount();
  seed();
});

for (const width of [390, 768]) {
  test(`cards load more as they scroll, without pages, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });

    const cards = page.locator('[data-slot="data-table-cards"] > li');
    await expect(cards).toHaveCount(20);
    await expect(page.getByRole('navigation', { name: 'Phân trang' })).toBeHidden();
    // While more is coming the end of the list says so with a spinning icon.
    const more = page.getByRole('status').filter({ hasText: 'Đang tải thêm…' });
    await expect(more.locator('svg.animate-spin')).toHaveCount(1);

    await page.getByText('Đang tải thêm…').scrollIntoViewIfNeeded();
    await expect(cards).toHaveCount(40);
    await page.getByText('Đang tải thêm…').scrollIntoViewIfNeeded();
    await expect(cards).toHaveCount(TOTAL);
    await expect(page.getByText(`${TOTAL} mẫu`, { exact: true })).toBeVisible();

    // A new search starts the list over.
    await page.getByPlaceholder('Tìm mẫu / cách đọc / nghĩa…').fill('パターン1');
    await expect(cards).toHaveCount(11); // 1, 10–19
  });
}

test('from 1024px the list is a table with pages', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await login(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-slot="data-table-cards"]')).toBeHidden();
  await expect(page.locator('table')).toBeVisible();
  await expect(page.getByText(new RegExp(`/ ${TOTAL} mẫu`))).toBeVisible();
});

test('groups are cards that load more as they scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/resources?tab=groups', { waitUntil: 'networkidle' });
  const cards = page.locator('ul > li').filter({ has: page.locator('a[href^="/groups/"]') });
  await expect(cards).toHaveCount(20);
  await expect(page.getByRole('navigation', { name: 'Phân trang' })).toHaveCount(0);
  await page.getByText('Đang tải thêm…').scrollIntoViewIfNeeded();
  await expect(cards).toHaveCount(GROUPS);
  await expect(page.getByRole('status').filter({ hasText: `${GROUPS} nhóm` })).toBeVisible();
});

// thien, 2026-10-24: the table's footer (count, rows per page, pages) rests on the bottom of the
// window, PAGE_CHROME's 32px above it, however many whole rows fit; the space no row fills sits
// above the footer, not below it.
for (const [width, height] of [
  [1440, 900],
  [1024, 800],
  [1280, 1000],
] as const) {
  test(`the table footer rests 32px above the window bottom at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await login(page);
    await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
    const nav = page.getByRole('navigation', { name: 'Phân trang' });
    await expect(nav).toBeVisible();
    await expect
      .poll(async () => {
        const footer = await nav.evaluate((el) => {
          let box = el as HTMLElement;
          while (box.parentElement && !box.parentElement.matches('.space-y-4'))
            box = box.parentElement;
          return box.getBoundingClientRect().bottom;
        });
        return Math.round(height - footer);
      })
      .toBe(32);
    const scroll = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    expect(scroll, 'a fitted page does not scroll').toBeLessThanOrEqual(0);
  });
}
