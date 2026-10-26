import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, ownSeedRows, seedE2eAccount } from './fixtures';

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
       VALUES (?, ?, 'grammar', NULL, ?, ?, ?)`,
    );
    for (let i = 0; i < GROUPS; i++)
      group.run(
        `grp${i}`,
        i === 0
          ? `Nhóm có một cái tên rất dài để xem thẻ có giữ chiều cao không ${'dài '.repeat(20)}`
          : `Nhóm ${i + 1}`,
        i === 0 ? `Ghi chú rất dài ${'ghi chú '.repeat(40)}` : null,
        iso(now - i * 60_000),
        iso(now - i * 60_000),
      );
  } finally {
    ownSeedRows(db);
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
    // The end of the list says nothing more: the header already has the count.
    await expect(page.getByText('Đang tải thêm…')).toHaveCount(0);

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
  await expect(page.getByText('Đang tải thêm…')).toHaveCount(0);

  // thien, 2026-10-24: every card is one height, a long name and note are cut at two lines each,
  // and a card without a note says so.
  const heights = await cards.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().height)),
  );
  expect(new Set(heights).size, `card heights ${heights.join(', ')}`).toBe(1);
  await expect(cards.nth(1).getByText('Chưa có ghi chú')).toBeVisible();
});

test('on a phone the search grows to full width while in use, the tools move below', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  const bar = page.locator('[data-slot="search-toolbar"]').filter({ visible: true }).first();
  const search = bar.getByRole('textbox');
  const filter = bar.getByRole('button', { name: /^Bộ lọc/ });
  const box = async (l: typeof search) => (await l.boundingBox())!;

  await expect
    .poll(async () => Math.round((await box(filter)).y - (await box(search)).y))
    .toBeLessThan(8);
  await search.click();
  await expect
    .poll(async () => Math.round((await box(bar)).width - (await box(search)).width))
    .toBeLessThan(2);
  await expect
    .poll(async () => (await box(filter)).y - ((await box(search)).y + (await box(search)).height))
    .toBeGreaterThan(0);
  // thien, 2026-10-25: below it, sort and filter share the full width equally.
  const sort = bar.getByRole('button', { name: /Sắp xếp/ });
  await expect
    .poll(async () => {
      const [b, so, fi] = [await box(bar), await box(sort), await box(filter)];
      return [
        Math.round(so.x - b.x),
        Math.round(b.x + b.width - (fi.x + fi.width)),
        Math.abs(Math.round(so.width - fi.width)),
        Math.round(b.width - so.width - fi.width), // the row's 8px gap
      ];
    })
    .toEqual([0, 0, 0, 8]);
  // A query keeps it open after focus leaves; clearing it brings the row back.
  await search.fill('パターン');
  await page.locator('body').click({ position: { x: 5, y: 600 } });
  await expect
    .poll(async () => Math.round((await box(bar)).width - (await box(search)).width))
    .toBeLessThan(2);
  await search.fill('');
  await page.locator('body').click({ position: { x: 5, y: 600 } });
  await expect
    .poll(async () => Math.round((await box(filter)).y - (await box(search)).y))
    .toBeLessThan(8);
});

test('a table that fits one page has no footer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await expect(page.getByRole('navigation', { name: 'Phân trang' })).toBeVisible();
  await page.getByPlaceholder('Tìm mẫu / cách đọc / nghĩa…').fill('パターン45');
  await expect(page.locator('table tbody tr')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Phân trang' })).toHaveCount(0);
  await expect(page.getByText('Số dòng')).toHaveCount(0);
  await expect(page.getByText(/^1–1 \//)).toHaveCount(0);
});

test('the filter panel lines up with the right edge of its button on a laptop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  const trigger = page
    .getByRole('button', { name: /^Bộ lọc/ })
    .filter({ visible: true })
    .first();
  await trigger.click();
  const panel = page.locator('[data-slot="popover-content"]');
  await expect(panel).toBeVisible();
  const t = (await trigger.boundingBox())!;
  const p = (await panel.boundingBox())!;
  expect(Math.abs(t.x + t.width - (p.x + p.width)), 'right edges').toBeLessThan(2);
  expect(p.x, 'inside the window').toBeGreaterThanOrEqual(0);
  // Raised like the menus (thien, 2026-10-25): a 2px edge and a lip under it.
  const look = await panel.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { edge: cs.borderTopWidth, lip: cs.boxShadow };
  });
  expect(look.edge).toBe('2px');
  expect(look.lip).toMatch(/0px 2px 0px/);
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
