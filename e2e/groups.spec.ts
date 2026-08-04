// Study groups, end to end in a real browser with a real session.
//
// The feature came back single-user on 2026-08-05 and had unit tests for lib/groups.ts but NO browser
// coverage — and two of its controls (BulkGroupButton, ItemGroups) shipped fully written and NEVER
// IMPORTED for two days. Nothing failed: typecheck is happy with an unused module, and the unit tests
// exercise the DB layer those components call. Only rendering the page shows a menu that is not there.
//
// What each step pins down, beyond "it does not crash":
//   1. the kind guard reaches the UI — a vocab-only group is not offered to a grammar selection
//   2. the item-detail chips read the same membership the table just wrote
//   3. "Gỡ khỏi nhóm" lists only groups the selection is in, and disappears when that set is empty
//      (which is what the per-row `groupIds` from listItems({ withGroupIds }) is for)
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

test('bulk add/remove to group, and the item-detail membership chips', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const item = db.prepare(
    `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
       captureReason, suspended, starred, createdAt, challengeObservations)
     VALUES (?, ?, ?, NULL, NULL, ?, 'N2', NULL, 'MCP', NULL, 0, 0, ?, 0)`,
  );
  item.run('g0', 'GRAMMAR', '〜ばかりに', 'chỉ vì', iso(now));
  item.run('g1', 'GRAMMAR', '〜ざるを得ない', 'buộc phải', iso(now - 1000));
  item.run('v0', 'VOCAB', '把握', 'nắm bắt', iso(now - 2000));
  db.prepare(
    `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
  ).run('grp1', 'Nhóm N2', 'grammar', iso(now), iso(now));
  db.prepare(
    `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
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

  // ---- 1. bulk ADD from the grammar table -------------------------------------------------
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await page.getByRole('button', { name: 'Thêm vào nhóm' }).click();
  // the vocab-only group must NOT be offered to a grammar selection
  await expect(page.getByRole('menuitem', { name: /Chỉ từ vựng/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: /Nhóm N2/ }).click();
  await expect(page.getByText(/Đã thêm 2 mục vào nhóm/)).toBeVisible({ timeout: 10_000 });

  // ---- 2. the detail page now shows the chip, and offers no second copy ---------------------
  await page.goto('/resources/g0', { waitUntil: 'networkidle' });
  await expect(page.getByRole('link', { name: 'Nhóm N2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm vào nhóm' })).toHaveCount(0);

  // ---- 3. remove it from the detail page ---------------------------------------------------
  await page.getByRole('button', { name: 'Gỡ khỏi nhóm Nhóm N2' }).click();
  await expect(page.getByText(/Đã gỡ khỏi nhóm/)).toBeVisible({ timeout: 10_000 });
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Thêm vào nhóm' })).toBeVisible();

  // ---- 4. bulk REMOVE only lists groups the selection is actually in ------------------------
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await page.getByRole('button', { name: 'Gỡ khỏi nhóm' }).click();
  await page.getByRole('menuitem', { name: /Nhóm N2/ }).click();
  await expect(page.getByText(/Đã gỡ 1 mục khỏi nhóm/)).toBeVisible({ timeout: 10_000 });

  // now nothing is in any group → the remove button disappears entirely
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await expect(page.getByRole('button', { name: 'Gỡ khỏi nhóm' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thêm vào nhóm' })).toBeVisible();

  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});
