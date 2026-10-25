import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// docs/ui-standard.md › Nút và ô: a menu or popover opens fully inside the screen and keeps the
// page's 16px gutter from every edge (thien, 2026-10-25). Before the shared default, the item's
// group menu at 390px ran flush to the right edge.
const GUTTER = 16;

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
  const now = Date.now();
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    db.prepare(
      `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt)
       VALUES ('mb0', 'GRAMMAR', '〜ばかりに', NULL, NULL, 'chỉ vì', 'N2', NULL, 'MCP', NULL, 0, 0, ?)`,
    ).run(iso(now));
    const group = db.prepare(
      `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt) VALUES (?, ?, 'grammar', NULL, NULL, ?, ?)`,
    );
    group.run('mbA', 'Ngữ pháp N2', iso(now), iso(now));
    group.run('mbB', 'Ôn thi tháng 12 có một cái tên khá dài', iso(now), iso(now));
    db.prepare(`INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('mbA', 'mb0', ?)`).run(
      iso(now),
    );
  } finally {
    db.close();
  }
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

async function expectInside(page: Page, selector: string, what: string) {
  const menu = page.locator(selector).filter({ visible: true }).first();
  await expect(menu).toBeVisible();
  await page.waitForTimeout(250); // the open animation scales from 95%
  const box = (await menu.boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(
    {
      left: Math.round(box.x) >= GUTTER,
      right: Math.round(box.x + box.width) <= vw - GUTTER,
    },
    `${what} at ${vw}px spans x=${Math.round(box.x)} to ${Math.round(box.x + box.width)}`,
  ).toEqual({ left: true, right: true });
}

for (const width of [360, 390, 1440]) {
  test(`the item's group menu keeps the gutter at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/resources/mb0', { waitUntil: 'networkidle' });
    const add = page.getByRole('button', { name: 'Thêm vào nhóm' }).filter({ visible: true });
    await add.scrollIntoViewIfNeeded();
    await add.click();
    await expectInside(page, '[data-slot="dropdown-menu-content"]', 'group menu');
  });
}

test('the table tools keep the gutter at 1024px', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await login(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Bộ lọc' }).filter({ visible: true }).first().click();
  await expectInside(page, '[data-slot="popover-content"]', 'filter popover');
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Hiển thị cột' })
    .filter({ visible: true })
    .first()
    .click();
  await expectInside(page, '[data-slot="dropdown-menu-content"]', 'column menu');
});
