import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

test('bulk add/remove to group, and the item-detail membership chips', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const item = db.prepare(
    `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
       captureReason, suspended, starred, createdAt)
     VALUES (${E2E_OWNER}, ?, ?, ?, NULL, NULL, ?, 'N2', NULL, 'MCP', NULL, 0, 0, ?)`,
  );
  item.run('g0', 'GRAMMAR', '〜ばかりに', 'chỉ vì', iso(now));
  item.run('g1', 'GRAMMAR', '〜ざるを得ない', 'buộc phải', iso(now - 1000));
  item.run('v0', 'VOCAB', '把握', 'nắm bắt', iso(now - 2000));
  db.prepare(
    `INSERT INTO "Group" (userId, id, name, kind, color, note, createdAt, updatedAt)
     VALUES (${E2E_OWNER}, ?, ?, ?, NULL, NULL, ?, ?)`,
  ).run('grp1', 'Nhóm N2', 'grammar', iso(now), iso(now));
  db.prepare(
    `INSERT INTO "Group" (userId, id, name, kind, color, note, createdAt, updatedAt)
     VALUES (${E2E_OWNER}, ?, ?, ?, NULL, NULL, ?, ?)`,
  ).run('grp2', 'Chỉ từ vựng', 'vocab', iso(now), iso(now));
  db.close();

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().split('\n')[0]));

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await page.getByRole('button', { name: 'Thêm vào nhóm' }).click();
  await expect(page.getByRole('menuitem', { name: /Chỉ từ vựng/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: /Nhóm N2/ }).click();
  await expect(page.getByText(/Đã thêm 2 mục vào nhóm/)).toBeVisible({ timeout: 10_000 });

  await page.goto('/resources/g0', { waitUntil: 'networkidle' });
  await expect(page.getByRole('link', { name: 'Nhóm N2' })).toBeVisible();
  // The add button stays (one add button everywhere, thien round 1); with every fitting group
  // used, its menu offers only a new group.
  await page.getByRole('button', { name: 'Thêm vào nhóm' }).click();
  await expect(page.getByRole('menuitem', { name: /Nhóm N2/ })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Nhóm mới' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Gỡ khỏi nhóm Nhóm N2' }).click();
  await expect(page.getByText(/Đã gỡ khỏi nhóm/)).toBeVisible({ timeout: 10_000 });
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Thêm vào nhóm' })).toBeVisible();

  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await page.getByRole('button', { name: 'Gỡ khỏi nhóm' }).click();
  await page.getByRole('menuitem', { name: /Nhóm N2/ }).click();
  await expect(page.getByText(/Đã gỡ 1 mục khỏi nhóm/)).toBeVisible({ timeout: 10_000 });

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await expect(page.getByRole('button', { name: 'Gỡ khỏi nhóm' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thêm vào nhóm' })).toBeVisible();

  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

// docs/ui-standard.md: adding is a page of its own at every width, never a form in a dialog. The
// list's one create action is "Thêm" in the page header, following the open tab.
test('creating a group is a page, from the header, at every width', async ({ page }) => {
  await seedE2eAccount();
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  for (const [width, height] of [
    [1280, 800],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/resources?tab=groups', { waitUntil: 'networkidle' });
    const add = page.locator('header').getByRole('link', { name: 'Thêm', exact: true });
    await expect(add, `${width}px: one Thêm in the header`).toHaveCount(1);
    await add.click();
    await page.waitForURL((u) => u.pathname === '/groups/new', { timeout: 15_000 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('Tên nhóm')).toBeVisible();
  }
});
