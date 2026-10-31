import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// K7: a Kaiwa script on Kho chung. Its author shares it from the script's page, updates the share
// after an edit and takes it down; another learner reads it on its own page and takes a copy into
// Hội thoại.
const OWN = 'kl-own';
const OTHER = 'kl-other';
const SHARED = 'kl-other-1';
const BODY = 'A: いらっしゃいませ。 | Xin mời vào.\nB: 二人です。 | Hai người.';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

const open = () => new Database(path.join(process.cwd(), E2E_DB_FILE));

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = open();
  const now = new Date().toISOString();
  try {
    db.pragma('foreign_keys = ON');
    db.exec(`DELETE FROM LibraryEntry WHERE type = 'SCRIPT'`);
    db.exec(`DELETE FROM Script WHERE userId = ${E2E_OWNER} AND (id = '${OWN}' OR libraryEntryId IS NOT NULL)`);
    db.exec(`DELETE FROM user WHERE id = '${OTHER}'`);
    db.prepare(
      `INSERT INTO Script (id, userId, title, body, analysis, version, createdAt, updatedAt)
       VALUES ('${OWN}', ${E2E_OWNER}, 'Kịch bản chia sẻ e2e', ?, NULL, 1, ?, ?)`,
    ).run(BODY, now, now);
    db.prepare(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, role, banned)
       VALUES ('${OTHER}', 'Người khác', 'kl-other@example.test', 1, ?, ?, 'user', 0)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO LibraryEntry (id, type, name, body, origin, authorId, status, takeCount,
         createdAt, updatedAt)
       VALUES ('${SHARED}', 'SCRIPT', 'Ở ga (e2e)', ?, 'LEARNER', '${OTHER}', 'public', 0, ?, ?)`,
    ).run('A: 切符をください。 | Cho tôi vé.\nB: どちらまでですか。 | Đi đến đâu ạ?', now, now);
  } finally {
    db.close();
  }
});

test.afterAll(() => {
  const db = open();
  try {
    db.pragma('foreign_keys = ON');
    db.exec(`DELETE FROM LibraryEntry WHERE type = 'SCRIPT'`);
    db.exec(`DELETE FROM user WHERE id = '${OTHER}'`);
  } finally {
    db.close();
  }
});

test("share a script, update the share after an edit, take it down", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  const dialog = page.getByRole('dialog');

  await page.goto(`/kaiwa/${OWN}`);
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  await expect(dialog).toContainText('Đi kèm: tiêu đề và toàn bộ nội dung');
  await dialog.getByRole('button', { name: 'Công khai' }).click();
  await expect(page.getByText('Đã chia sẻ lên Kho chung')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Đang chia sẻ' })).toBeVisible();

  // On Kho chung, marked as the learner's own.
  await page.goto('/library?tab=scripts');
  const card = page.locator('[data-slot="library-script"]', { hasText: 'Kịch bản chia sẻ e2e' });
  await expect(card).toContainText('2 vai · 2 câu');
  await expect(card).toContainText('Đã có');

  // Edited after sharing: the share waits for Cập nhật.
  const db = open();
  db.prepare(`UPDATE Script SET body = ?, version = version + 1 WHERE id = '${OWN}'`).run(
    `${BODY}\nA: こちらへどうぞ。 | Mời đi lối này.`,
  );
  db.close();
  await page.goto(`/kaiwa/${OWN}`);
  await page.getByRole('button', { name: 'Đang chia sẻ' }).click();
  await expect(dialog).toContainText('Kịch bản đã sửa từ lần chia sẻ trước');
  await dialog.getByRole('button', { name: 'Cập nhật' }).click();
  await expect(page.getByText('Đã cập nhật bản chia sẻ')).toBeVisible();
  await page.goto('/library?tab=scripts');
  await expect(card).toContainText('2 vai · 3 câu');

  // Taken down: gone from Kho chung.
  await page.goto(`/kaiwa/${OWN}`);
  await page.getByRole('button', { name: 'Đang chia sẻ' }).click();
  await dialog.getByRole('button', { name: 'Gỡ khỏi Kho chung' }).click();
  await expect(page.getByText('Đã gỡ khỏi Kho chung')).toBeVisible();
  await page.goto('/library?tab=scripts');
  await expect(card).toHaveCount(0);
});

test("read another learner's script, take a copy, then open it", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);

  await page.goto('/library');
  await page.getByRole('tab', { name: 'Kịch bản' }).click();
  const search = page.getByRole('searchbox', { name: 'Tìm kịch bản' });
  await search.fill('切符');
  await search.press('Enter');
  await page.waitForURL(/sq=/);
  const card = page.locator('[data-slot="library-script"]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Ở ga (e2e)');
  await expect(card).toContainText('Người khác');
  await expect(card).not.toContainText('Đã có');

  await card.getByRole('link', { name: 'Mở Ở ga (e2e)' }).click();
  await page.waitForURL(`**/library/script/${SHARED}`);
  await expect(page.getByRole('heading', { name: 'Ở ga (e2e)' })).toBeVisible();
  await expect(page.getByText('Cho tôi vé.')).toBeVisible();

  await page.getByRole('button', { name: 'Lấy về' }).click();
  await expect(page.getByText('Đã lấy về Hội thoại')).toBeVisible();
  await page.waitForURL(/\/kaiwa\/(?!new)[^/?]+$/);
  await expect(page.getByRole('heading', { name: 'Ở ga (e2e)' })).toBeVisible();

  // Taken once: the shared page now opens the copy, and the count went up.
  await page.goto(`/library/script/${SHARED}`);
  await expect(page.getByRole('link', { name: 'Kịch bản của bạn' })).toBeVisible();
  await expect(page.getByText('1 lượt lấy').filter({ visible: true })).toHaveCount(1);
  await page.goto('/library?tab=scripts&sq=切符');
  await expect(card).toContainText('Đã có');

  // A search that finds nothing says so.
  await page.goto('/library?tab=scripts&sq=không-có-đâu');
  await expect(page.getByText('Không có kịch bản nào khớp.')).toBeVisible();
});
