import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// docs/ui-standard.md › Bố cục: below 1024px a list is cards that load more as you scroll, with no
// pagination; from 1024px it is a table with pages.

const TOTAL = 45;

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
