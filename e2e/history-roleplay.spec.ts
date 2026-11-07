import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// Kaiwa d2 (docs/plans/2026-11-07-kaiwa-voices-roleplay.md): Lịch sử › Nhập vai lists the
// role-plays kaiwa_roleplay_save stored, one card each; a card opens the session turn by turn.
const BODY = [
  'A: いらっしゃいませ。 | Xin mời vào.',
  'B: 二人です。 | Hai người.',
  'A: こちらへどうぞ。 | Mời đi lối này.',
  'B: ありがとうございます。 | Cảm ơn.',
].join('\n');

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

function seed({ roleplays }: { roleplays: boolean }) {
  const d = new Database(path.join(process.cwd(), E2E_DB_FILE));
  d.exec(`DELETE FROM Roleplay; DELETE FROM Script WHERE id = 'kw-played'`);
  const now = new Date().toISOString();
  d.prepare(
    `INSERT INTO Script (id, userId, title, body, analysis, version, createdAt, updatedAt)
     VALUES ('kw-played', ${E2E_OWNER}, 'Ở quán', ?, NULL, 1, ?, ?)`,
  ).run(BODY, now, now);
  if (roleplays) {
    const insert = d.prepare(
      `INSERT INTO Roleplay (id, userId, scriptId, scriptTitle, part, turns, total, correct, createdAt)
       VALUES (?, ${E2E_OWNER}, ?, ?, 'B', ?, ?, ?, ?)`,
    );
    insert.run(
      'rp-1',
      'kw-played',
      'Ở quán',
      JSON.stringify([
        { turn: 2, said: '二人です', ok: true, note: 'Đúng ý, tự nhiên.' },
        {
          turn: 4,
          said: 'ありがとう',
          ok: false,
          note: 'Ở quán nên nói lịch sự: ありがとうございます。',
        },
      ]),
      2,
      1,
      new Date(Date.now() - 3_600_000).toISOString(),
    );
    insert.run(
      'rp-2',
      'kw-gone',
      'Kịch bản đã xoá',
      JSON.stringify([{ turn: 1, said: 'すみません', ok: true }]),
      1,
      1,
      new Date(Date.now() - 86_400_000).toISOString(),
    );
  }
  d.close();
}

test.beforeEach(async () => {
  await seedE2eAccount();
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`Nhập vai lists saved role-plays and opens one turn by turn (${width}px)`, async ({
    page,
  }) => {
    seed({ roleplays: true });
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/history', { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: 'Luyện dịch' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: 'Nhập vai' }).click();
    await expect(page).toHaveURL(/tab=nhap-vai/);
    await expect(page.getByText('2 buổi nhập vai')).toBeVisible();
    const cards = page.locator('[data-slot="roleplay-card"]');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Ở quán');
    await expect(cards.first()).toContainText('Vai B');
    await expect(cards.first()).toContainText('1/2 câu đúng ý');
    const shots = process.env.SCREENSHOT_DIR;
    await page.mouse.move(0, 0);
    if (shots) await page.screenshot({ path: path.join(shots, `lich-su-nhap-vai-${width}.png`) });

    await cards.first().getByRole('button', { name: 'Xem buổi nhập vai Ở quán' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ở quán' });
    const turns = dialog.locator('[data-slot="roleplay-turn"]');
    await expect(turns).toHaveCount(2);
    await expect(turns.nth(0)).toContainText('Câu mẫu: 二人です。 (Hai người.)');
    await expect(turns.nth(0)).toContainText('Bạn nói: 二人です');
    await expect(turns.nth(1)).toHaveAttribute('data-ok', 'false');
    await expect(turns.nth(1)).toContainText('Chưa đúng');
    await expect(turns.nth(1)).toContainText('ありがとうございます。');
    await page.waitForTimeout(300);
    if (shots)
      await page.screenshot({ path: path.join(shots, `lich-su-nhap-vai-chi-tiet-${width}.png`) });
    await expect(dialog.getByRole('link', { name: 'Mở kịch bản' })).toHaveAttribute(
      'href',
      '/kaiwa/kw-played',
    );
    await dialog.getByRole('button', { name: 'Nhập vai lại' }).click();
    await expect(
      page.getByText('Nhập vai kịch bản Kaiwa "Ở quán" trong sakubun, tôi là B'),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // A role-play whose script is gone still opens, without its model lines or the link.
    await cards.nth(1).getByRole('button').first().click();
    const gone = page.getByRole('dialog', { name: 'Kịch bản đã xoá' });
    await expect(gone.locator('[data-slot="roleplay-turn"]')).toContainText('Bạn nói: すみません');
    await expect(gone.getByText('Câu mẫu')).toHaveCount(0);
    await expect(gone.getByRole('link', { name: 'Mở kịch bản' })).toHaveCount(0);
  });
}

test('Nhập vai says how to start when nothing is saved yet', async ({ page }) => {
  seed({ roleplays: false });
  await signIn(page);
  await page.goto('/history?tab=nhap-vai', { waitUntil: 'networkidle' });
  await expect(page.getByText('Chưa có buổi nhập vai nào')).toBeVisible();
  await expect(page.getByText('0 buổi nhập vai')).toBeVisible();
});
