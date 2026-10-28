import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// Phase 8, L2: Kho chung lists shared groups and entries; "Lấy" copies one entry into the learner's
// own items, "Lấy cả nhóm" copies what is missing and makes the group theirs.
const GROUP = 'lib-e2e';
const ENTRIES = [
  { id: 'lib-e2e-1', type: 'GRAMMAR', expression: '〜てみるテスト', meaningVi: 'thử làm (e2e)' },
  { id: 'lib-e2e-2', type: 'VOCAB', expression: '試験語', meaningVi: 'từ thử nghiệm (e2e)' },
];

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = new Date().toISOString();
  try {
    db.pragma('foreign_keys = ON');
    const expressions = ENTRIES.map((e) => `'${e.expression}'`).join(', ');
    db.exec(`DELETE FROM Item WHERE userId = ${E2E_OWNER} AND expression IN (${expressions})`);
    db.exec(`DELETE FROM "Group" WHERE userId = ${E2E_OWNER} AND libraryEntryId = '${GROUP}'`);
    db.exec(`DELETE FROM LibraryEntry WHERE id LIKE '${GROUP}%'`);
    const entry = db.prepare(
      `INSERT INTO LibraryEntry (id, type, expression, meaningVi, level, name, groupKind, notes,
         origin, status, takeCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'N5', ?, ?, ?, 'LEARNER', 'public', 0, ?, ?)`,
    );
    entry.run(GROUP, 'GROUP', null, null, 'Nhóm thử e2e', 'mixed', 'Hai mục để thử lấy.', now, now);
    ENTRIES.forEach((e, i) => {
      entry.run(e.id, e.type, e.expression, e.meaningVi, null, null, null, now, now);
      db.prepare(
        `INSERT INTO LibraryGroupMember (groupEntryId, itemEntryId, position) VALUES (?, ?, ?)`,
      ).run(GROUP, e.id, i);
    });
  } finally {
    db.close();
  }
});

test('Kho chung: take one entry, then the whole group', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  const shots = process.env.SCREENSHOT_DIR;

  // The groups tab: OpenJLPT's level groups as a table, then the learners' groups.
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Kho chung' })).toBeVisible();
  await expect(
    page.locator('[data-slot="library-levels"]').getByRole('link').first(),
  ).toHaveAccessibleName(/^Mở N5 · Ngữ pháp: \d+ mục/);
  await expect(page.getByRole('link', { name: 'Mở Nhóm thử e2e' })).toBeVisible();
  if (shots)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: path.join(shots, `library-groups-${width}.png`) });
    }
  await page.setViewportSize({ width: 1440, height: 900 });

  // One entry, found by search.
  await page.getByRole('tab', { name: 'Từng mục' }).click();
  await page.getByRole('searchbox', { name: 'Tìm trong kho chung' }).fill('試験語');
  await page.getByRole('searchbox', { name: 'Tìm trong kho chung' }).press('Enter');
  await page.waitForURL(/q=/);
  const found = page.locator('[data-slot="library-entry"]');
  await expect(found).toHaveCount(1);
  await expect(found).toContainText('từ thử nghiệm (e2e)');
  await found.getByRole('button', { name: 'Lấy 試験語 về kho' }).click();
  await expect(page.getByText('Đã lấy 試験語 về kho')).toBeVisible();
  await expect(found.getByRole('link', { name: 'Đã có' })).toBeVisible();
  if (shots)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: path.join(shots, `library-items-${width}.png`) });
    }
  await page.setViewportSize({ width: 1440, height: 900 });

  // The group: one of its two is already the learner's, so taking it adds one.
  await page.goto(`/library/${GROUP}`);
  await expect(page.getByRole('heading', { name: 'Nhóm thử e2e' })).toBeVisible();
  const have = page.locator('[data-slot="group-have"]');
  await expect(have).toContainText('Đã có 1/2');
  await page.getByRole('button', { name: 'Lấy cả nhóm' }).click();
  await expect(page.getByText('Đã lấy nhóm, thêm 1 mục mới vào kho')).toBeVisible();
  await expect(have).toContainText('Đã có đủ');
  const mine = page.getByRole('link', { name: 'Nhóm của bạn' });
  await expect(mine).toBeVisible();
  if (shots)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({
        path: path.join(shots, `library-group-${width}.png`),
        fullPage: true,
      });
    }
  await page.setViewportSize({ width: 1440, height: 900 });

  // The learner's own group holds both, each with its own schedule.
  await mine.click();
  await page.waitForURL(/\/groups\//);
  await expect(page.getByRole('heading', { name: 'Nhóm thử e2e' })).toBeVisible();
  await expect(page.getByText('Xem chi tiết 〜てみるテスト').first()).toBeAttached();
  await expect(page.getByText('Xem chi tiết 試験語').first()).toBeAttached();
});

// thien, 7.4h: the level table says how much of each OpenJLPT group the learner has; a group page
// finds an entry in it, and once taken, "Lấy phần còn thiếu" fills it again.
test('Kho chung groups: progress by level, search in a group, fill what is missing', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const open = () => new Database(path.join(process.cwd(), E2E_DB_FILE));
  const expressions = ENTRIES.map((e) => `'${e.expression}'`).join(', ');
  let db = open();
  db.pragma('foreign_keys = ON');
  db.exec(`DELETE FROM Item WHERE userId = ${E2E_OWNER} AND expression IN (${expressions})`);
  db.exec(`DELETE FROM "Group" WHERE userId = ${E2E_OWNER} AND libraryEntryId = '${GROUP}'`);
  db.close();

  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/library');
  const n5 = page
    .locator('[data-slot="library-levels"]')
    .getByRole('link', { name: /^Mở N5 · Ngữ pháp/ });
  const owned = async () => {
    const name = (await n5.getAttribute('aria-label')) ?? '';
    const m = name.match(/đã có (\d+)\/|đã có đủ|chưa có/);
    return m?.[1] ? Number(m[1]) : name.includes('chưa có') ? 0 : -1;
  };
  const before = await owned();
  expect(before).toBeGreaterThanOrEqual(0);

  // One more N5 pattern of the learner's own counts in the table, however it came.
  db = open();
  const pick = db
    .prepare(
      `SELECT e.expression, e.meaningVi FROM LibraryEntry e
         JOIN LibraryGroupMember m ON m.itemEntryId = e.id
         JOIN LibraryEntry g ON g.id = m.groupEntryId
       WHERE g.sourceKey = 'openjlpt:group:N5:GRAMMAR'
         AND NOT EXISTS (SELECT 1 FROM Item i WHERE i.userId = ${E2E_OWNER}
           AND i.kind = 'GRAMMAR' AND i.expression = e.expression)
       LIMIT 1`,
    )
    .get() as { expression: string; meaningVi: string };
  db.prepare(
    `INSERT INTO Item (id, userId, kind, expression, meaningVi, level, source, createdAt)
     VALUES ('lib-e2e-progress', ${E2E_OWNER}, 'GRAMMAR', ?, ?, 'N5', 'MANUAL', ?)`,
  ).run(pick.expression, pick.meaningVi, new Date().toISOString());
  db.close();
  try {
    await page.reload();
    await expect.poll(owned).toBe(before + 1);
  } finally {
    db = open();
    db.exec(`DELETE FROM Item WHERE id = 'lib-e2e-progress'`);
    db.close();
  }

  // The learners' group shows who shared it (here an account since deleted).
  await expect(
    page.locator('[data-slot="library-group"]', { hasText: 'Nhóm thử e2e' }),
  ).toContainText('Người dùng đã xoá');

  // The group page: a search finds one entry; taken whole, then one item deleted, it fills again.
  await page.goto(`/library/${GROUP}`);
  const cards = page.locator('[data-slot="library-entry"]');
  await expect(cards).toHaveCount(2);
  await page.getByLabel('Tìm trong nhóm').fill('thử nghiệm');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('試験語');
  await page.getByLabel('Tìm trong nhóm').fill('không có');
  await expect(page.getByText('Không có mục nào khớp trong nhóm này.')).toBeVisible();
  await page.getByLabel('Tìm trong nhóm').fill('');

  const have = page.locator('[data-slot="group-have"]');
  await expect(have).toContainText('Chưa có');
  await expect(have.getByRole('button', { name: 'Lấy phần còn thiếu' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lấy cả nhóm' }).click();
  await expect(have).toContainText('Đã có đủ');

  db = open();
  db.pragma('foreign_keys = ON');
  db.exec(`DELETE FROM Item WHERE userId = ${E2E_OWNER} AND expression = '試験語'`);
  db.close();
  await page.reload();
  await expect(have).toContainText('Đã có 1/2');
  await have.getByRole('button', { name: 'Lấy phần còn thiếu' }).click();
  await expect(page.getByText('Đã lấy nhóm, thêm 1 mục mới vào kho')).toBeVisible();
  await expect(have).toContainText('Đã có đủ');
});

// Phase 8, L3: the learner shares an item of their own and a group from their pages, likes an
// entry on Kho chung, then takes the item down.
test('share an item and a group, like it, take it down', async ({ page }) => {
  test.setTimeout(120_000);
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = new Date().toISOString();
  try {
    db.pragma('foreign_keys = ON');
    db.exec(`DELETE FROM LibraryEntry WHERE authorId = ${E2E_OWNER}`);
    db.exec(`DELETE FROM Item WHERE userId = ${E2E_OWNER} AND id = 'lib-own-1'`);
    db.exec(`DELETE FROM "Group" WHERE userId = ${E2E_OWNER} AND id = 'lib-own-g'`);
    db.prepare(
      `INSERT INTO Item (id, userId, kind, expression, reading, meaningVi, level, notes, source, createdAt)
       VALUES ('lib-own-1', ${E2E_OWNER}, 'VOCAB', '自作語', 'じさくご', 'từ tự viết (e2e)', 'N3',
         'ghi chú riêng', 'MANUAL', ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO SrsState (id, itemId, userId, due) VALUES ('lib-own-srs', 'lib-own-1', ${E2E_OWNER}, ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO "Group" (id, userId, name, kind, note, createdAt, updatedAt)
       VALUES ('lib-own-g', ${E2E_OWNER}, 'Nhóm chia sẻ e2e', 'vocab', 'Một từ tự viết.', ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO GroupMember (userId, groupId, itemId, addedAt) VALUES (${E2E_OWNER}, 'lib-own-g', 'lib-own-1', ?)`,
    ).run(now);
  } finally {
    db.close();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  const shots = process.env.SCREENSHOT_DIR;
  const dialog = page.getByRole('dialog');

  // The item: what goes public, then Công khai.
  await page.goto('/resources/lib-own-1');
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  await expect(dialog).toContainText('Ghi chú, sao và lịch sử ôn vẫn là của riêng bạn');
  if (shots)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: path.join(shots, `share-item-${width}.png`) });
    }
  await page.setViewportSize({ width: 1440, height: 900 });
  await dialog.getByRole('button', { name: 'Công khai' }).click();
  await expect(page.getByText('Đã công khai lên Kho chung')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Đang chia sẻ' })).toBeVisible();

  // On Kho chung, without the private note; liked, and the like survives a reload.
  await page.goto('/library?tab=items&q=自作語');
  const card = page.locator('[data-slot="library-entry"]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Cộng đồng');
  await expect(card).not.toContainText('ghi chú riêng');
  await card.getByRole('button', { name: 'Thích 自作語' }).click();
  await expect(card.getByRole('button', { name: 'Bỏ thích 自作語' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.waitForTimeout(500);
  await page.reload();
  await expect(card.getByRole('button', { name: 'Bỏ thích 自作語' })).toContainText('1');

  // The group: the preview says the item is already shared as it is.
  await page.goto('/groups/lib-own-g');
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  await expect(dialog).toContainText('Nhóm và 1 mục dưới đây sẽ lên Kho chung');
  await expect(dialog.getByRole('listitem')).toContainText(['自作語Đã chia sẻ']);
  if (shots) await page.screenshot({ path: path.join(shots, 'share-group-1440.png') });
  await dialog.getByRole('button', { name: 'Công khai' }).click();
  await expect(page.getByText('Đã công khai nhóm và 1 mục')).toBeVisible();
  await page.goto('/library');
  await expect(page.getByRole('link', { name: 'Mở Nhóm chia sẻ e2e' })).toBeVisible();

  // Taken down: gone from search.
  await page.goto('/resources/lib-own-1');
  await page.getByRole('button', { name: 'Đang chia sẻ' }).click();
  await dialog.getByRole('button', { name: 'Gỡ khỏi Kho chung' }).click();
  await expect(page.getByText('Đã gỡ khỏi Kho chung')).toBeVisible();
  await page.goto('/library?tab=items&q=自作語');
  await expect(page.getByText('Không có mục nào khớp')).toBeVisible();
});

// Phase 8, L6: the admin (the e2e account is ALLOWED_EMAIL) hides another learner's entry from Kho
// chung, shows it again from that account's page; a ban hides it until it is lifted.
test('the admin hides and shows an entry; a ban hides it too', async ({ page }) => {
  test.setTimeout(120_000);
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = new Date().toISOString();
  const ban = (banned: boolean) =>
    db.prepare(`UPDATE user SET banned = ? WHERE id = 'lib-other'`).run(banned ? 1 : 0);
  db.pragma('foreign_keys = ON');
  db.exec(`DELETE FROM user WHERE id = 'lib-other'`);
  db.prepare(
    `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, role, banned)
     VALUES ('lib-other', 'Người khác', 'lib-other@example.test', 1, ?, ?, 'user', 0)`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO LibraryEntry (id, type, expression, meaningVi, level, origin, authorId, status,
       takeCount, createdAt, updatedAt)
     VALUES ('lib-other-1', 'VOCAB', '他人語', 'từ của người khác (e2e)', 'N4', 'LEARNER', 'lib-other',
       'public', 0, ?, ?)`,
  ).run(now, now);

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    const search = () => page.goto('/library?tab=items&q=他人語');
    const card = page.locator('[data-slot="library-entry"]');

    await search();
    await expect(card).toHaveCount(1);
    await card.getByRole('button', { name: 'Ẩn 他人語' }).click();
    await expect(page.getByText('Đã ẩn khỏi Kho chung')).toBeVisible();
    await search();
    await expect(page.getByText('Không có mục nào khớp')).toBeVisible();

    await page.goto('/admin/lib-other');
    const share = page.locator('[data-slot="account-share"]');
    await expect(share).toContainText('Quản trị đã ẩn');
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: path.join(process.env.SCREENSHOT_DIR, 'admin-shares-1440.png'),
        fullPage: true,
      });
    await share.getByRole('button', { name: 'Hiện lại 他人語' }).click();
    await expect(page.getByText('Đã hiện lại trên Kho chung')).toBeVisible();
    await expect(share).toContainText('Đang hiện');

    ban(true);
    await search();
    await expect(page.getByText('Không có mục nào khớp')).toBeVisible();
    ban(false);
    await search();
    await expect(card).toHaveCount(1);
  } finally {
    db.exec(`DELETE FROM user WHERE id = 'lib-other'`);
    db.close();
  }
});
