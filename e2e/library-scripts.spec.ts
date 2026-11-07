import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// K7b: Kaiwa scripts on Kho chung. A learner shares a script from its own page, finds shared ones
// under "Kịch bản", reads one before taking it, and "Lấy về" copies it into Hội thoại. An unedited
// copy cannot be shared again.
const SHARED = 'kwlib-e2e';
const OWN = 'kwlib-own';
const SHARED_BODY = [
  '駅の前で。 | Trước nhà ga.',
  'A: すみません、駅はどこですか。 | Xin lỗi, nhà ga ở đâu ạ?',
  'B: まっすぐ行って、右です。 | Đi thẳng rồi rẽ phải.',
  'A: ありがとうございます。 | Cảm ơn ạ.',
].join('\n');
const OWN_BODY = 'A: いらっしゃいませ。 | Xin mời vào.\nB: 二人です。 | Hai người.';

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
    db.exec(
      `DELETE FROM Script WHERE userId = ${E2E_OWNER}
         AND (id = '${OWN}' OR libraryEntryId LIKE 'kwlib%' OR title = 'Hỏi đường (e2e)')`,
    );
    db.exec(
      `DELETE FROM LibraryEntry WHERE id LIKE 'kwlib%' OR (type = 'SCRIPT' AND sourceId = '${OWN}')`,
    );
    db.prepare(
      `INSERT INTO LibraryEntry (id, type, name, body, origin, status, takeCount, createdAt, updatedAt)
       VALUES (?, 'SCRIPT', 'Hỏi đường (e2e)', ?, 'LEARNER', 'public', 2, ?, ?)`,
    ).run(SHARED, SHARED_BODY, now, now);
    db.prepare(
      `INSERT INTO Script (id, userId, title, body, version, createdAt, updatedAt)
       VALUES (?, ${E2E_OWNER}, 'Ở nhà hàng (e2e)', ?, 1, ?, ?)`,
    ).run(OWN, OWN_BODY, now, now);
  } finally {
    db.close();
  }
});

for (const width of [1440, 390]) {
  test(`Kho chung scripts: share one, read and take another at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(width === 390 && !process.env.SCREENSHOT_DIR, 'the phone run only takes screenshots');
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    const shot = (name: string) =>
      process.env.SCREENSHOT_DIR
        ? page.screenshot({
            path: path.join(process.env.SCREENSHOT_DIR, `${name}-${width}.png`),
            fullPage: true,
          })
        : undefined;

    // Share the learner's own script from its page.
    await page.goto(`/kaiwa/${OWN}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('lấy một bản sao về Hội thoại');
    await shot('k7b-share-dialog');
    await dialog.getByRole('button', { name: 'Công khai' }).click();
    await expect(page.getByText('Đã công khai lên Kho chung')).toBeVisible();
    // Once shared, the dialog has the link to send a friend.
    await expect(dialog.getByRole('button', { name: 'Chép đường dẫn' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Mở trang chung' })).toHaveAttribute(
      'href',
      /^\/library\/script\//,
    );
    await shot('share-link-dialog');
    await page.keyboard.press('Escape');

    // Kho chung › Kịch bản lists both, the most taken first; the learner's own is marked as theirs.
    await page.goto('/library?tab=scripts', { waitUntil: 'networkidle' });
    const cards = page.locator('[data-slot="library-script"]');
    await expect(cards.first()).toContainText('Hỏi đường (e2e)');
    await expect(cards.first()).toContainText('すみません、駅はどこですか。');
    await expect(cards.first()).toContainText('4 câu');
    await expect(cards.first()).toContainText('2 vai');
    await expect(cards.first()).toContainText('2 lượt lấy');
    const mine = cards.filter({ hasText: 'Ở nhà hàng (e2e)' });
    await expect(mine).toContainText('Đã có');
    await shot('k7b-library-scripts');

    // The search goes to the server, by title or by a line.
    await page.getByLabel('Tìm kịch bản').fill('二人');
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Ở nhà hàng (e2e)');
    await page.getByLabel('Tìm kịch bản').fill('');

    // A shared script reads as a chat, with furigana, before it is taken.
    await cards.filter({ hasText: 'Hỏi đường (e2e)' }).getByRole('link').click();
    await page.waitForURL(`**/library/script/${SHARED}`);
    await expect(page.getByRole('heading', { name: 'Hỏi đường (e2e)' })).toBeVisible();
    await expect(page.locator('[data-slot="kaiwa-line"]')).toHaveCount(4);
    await expect(page.locator('rt').first()).toHaveText('えき');
    await shot('k7b-library-script');

    // Lấy về copies it into Hội thoại and opens the copy, which says where it came from.
    await page.getByRole('button', { name: 'Lấy về' }).click();
    await page.waitForURL(/\/kaiwa\/(?!kwlib)/);
    await expect(page.getByRole('heading', { name: 'Hỏi đường (e2e)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lấy từ Kho chung' })).toBeVisible();
    const copy = page.url();

    // Unedited, the copy cannot be shared again.
    await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('giống hệt bản bạn lấy từ Kho chung');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Công khai' })).toHaveCount(
      0,
    );
    await shot('k7b-copy-share-blocked');
    await page.keyboard.press('Escape');

    // Back on Kho chung, the shared script opens the copy instead of taking it again.
    await page.goto(`/library/script/${SHARED}`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Kịch bản của bạn' }).click();
    await page.waitForURL(copy);

    // Unsharing takes it off Kho chung.
    await page.goto(`/kaiwa/${OWN}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Đang chia sẻ' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Gỡ khỏi Kho chung' }).click();
    await expect(page.getByText('Đã gỡ khỏi Kho chung')).toBeVisible();
    await page.goto('/library?tab=scripts', { waitUntil: 'networkidle' });
    await expect(cards.filter({ hasText: 'Ở nhà hàng (e2e)' })).toHaveCount(0);

    // Leave the shared entry and the learner's script as they were for the next run.
    const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
    try {
      db.exec(`DELETE FROM Script WHERE userId = ${E2E_OWNER} AND libraryEntryId = '${SHARED}'`);
      db.exec(`UPDATE LibraryEntry SET takeCount = 2 WHERE id = '${SHARED}'`);
      db.exec(`DELETE FROM LibraryEntry WHERE type = 'SCRIPT' AND sourceId = '${OWN}'`);
    } finally {
      db.close();
    }
  });
}

// Anyone with the link reads a shared script, signed in or not (thien, 2026-11-07). A guest gets no
// speech, and "Đăng nhập để lấy về" brings them back to the same script once signed in.
for (const width of [1440, 390]) {
  test(`a guest reads a shared script from its link, then signs in to take it at ${width}px`, async ({
    page,
  }) => {
    test.skip(width === 390 && !process.env.SCREENSHOT_DIR, 'the phone run only takes screenshots');
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/library/script/${SHARED}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`/library/script/${SHARED}$`));
    await expect(page.getByRole('heading', { name: 'Hỏi đường (e2e)' })).toBeVisible();
    await expect(page.locator('[data-slot="kaiwa-line"]')).toHaveCount(4);
    await expect(page.locator('rt').first()).toHaveText('えき');
    await expect(page.locator('[data-slot="guest-note"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nghe câu' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nghe cả bài' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lấy về' })).toHaveCount(0);
    if (process.env.SCREENSHOT_DIR) {
      await page.screenshot({
        path: path.join(process.env.SCREENSHOT_DIR, `share-guest-${width}.png`),
        fullPage: true,
      });
    }

    await page.getByRole('link', { name: 'Đăng nhập để lấy về' }).click();
    await page.waitForURL(/\/login\?next=/);
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL(`**/library/script/${SHARED}`, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Lấy về' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nghe cả bài' })).toBeVisible();
  });
}

test('a hidden or missing shared script is not found for a guest', async ({ page }) => {
  await page.goto('/library/script/kwlib-missing');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
});
