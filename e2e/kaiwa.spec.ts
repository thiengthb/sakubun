import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// Phase 8, K3 and K4: a script Claude saved over MCP shows on Hội thoại; its page reads it as a chat
// from the part the learner picks, hides the Vietnamese on request, and deletes it after a confirm.
const BODY = [
  '店の中は静かだった。 | Trong quán yên tĩnh.',
  'A: いらっしゃいませ。何名様[なんめいさま]ですか。 | Xin mời vào. Quý khách đi mấy người ạ?',
  'B: 二人[ふたり]です。 | Hai người.',
  'A: こちらへどうぞ。 | Mời đi lối này.',
].join('\n');
// What a save stores (K4): the author's furigana where they wrote it, readings worked out elsewhere.
const ANALYSIS = JSON.stringify({
  v: 1,
  lines: [
    '店[みせ]の中[なか]は静[しず]かだった。',
    'いらっしゃいませ。何名様[なんめいさま]ですか。',
    '二人[ふたり]です。',
    'こちらへどうぞ。',
  ].map((ruby) => ({ ruby, tokens: [] })),
});

function db() {
  return new Database(path.join(process.cwd(), E2E_DB_FILE));
}

test('Hội thoại lists a saved script and its page reads it line by line', async ({ page }) => {
  await seedE2eAccount();
  const d = db();
  d.exec(`DELETE FROM Script WHERE userId = ${E2E_OWNER}`);
  d.prepare(
    `INSERT INTO Script (id, userId, title, body, analysis, version, createdAt, updatedAt)
     VALUES ('kw-e2e', ${E2E_OWNER}, 'Ở nhà hàng', ?, ?, 1, ?, ?)`,
  ).run(BODY, ANALYSIS, new Date().toISOString(), new Date().toISOString());
  d.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/kaiwa', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Hội thoại' })).toBeVisible();
  await expect(page.getByText('1 kịch bản')).toBeVisible();
  await page.getByRole('link', { name: 'Mở Ở nhà hàng' }).click();
  await page.waitForURL(/\/kaiwa\/kw-e2e$/);

  const lines = page.locator('[data-slot="kaiwa-line"]');
  await expect(lines).toHaveCount(4);
  await expect(lines.nth(1).getByLabel('Người nói A')).toBeVisible();
  await expect(lines.first().getByLabel(/Người nói/)).toHaveCount(0);
  await expect(page.getByText('Hai người.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nghe câu' })).toHaveCount(4);
  // Furigana: the saved readings on line 1, the author's on line 3.
  await expect(lines.first().locator('rt')).toHaveText(['みせ', 'なか', 'しず']);
  await expect(lines.nth(2).locator('rt')).toHaveText(['ふたり']);
  // The learner is A by default: A on the left, B on the right, the speaker-less line is the scene.
  await expect(lines.first()).toHaveAttribute('data-kind', 'scene');
  await expect(lines.nth(1)).toHaveAttribute('data-side', 'mine');
  await expect(lines.nth(2)).toHaveAttribute('data-side', 'theirs');
  const leftOf = async (i: number) =>
    (await lines.nth(i).locator('span[role="img"]').boundingBox())!.x;
  expect(await leftOf(1)).toBeLessThan(await leftOf(2));

  const shots = process.env.SCREENSHOT_DIR;
  if (shots)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({
        path: path.join(shots, `kaiwa-script-${width}.png`),
        fullPage: true,
      });
    }

  // Taking B's part turns the chat around, and the choice survives a reload.
  await page.getByRole('radio', { name: 'B' }).click();
  await expect(lines.nth(1)).toHaveAttribute('data-side', 'theirs');
  await expect(lines.nth(2)).toHaveAttribute('data-side', 'mine');
  expect(await leftOf(2)).toBeLessThan(await leftOf(1));
  await page.reload();
  await expect(lines.nth(2)).toHaveAttribute('data-side', 'mine');
  await page.getByRole('radio', { name: 'A' }).click();

  await page.getByRole('button', { name: 'Ẩn nghĩa' }).click();
  await expect(page.getByText('Hai người.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hiện nghĩa' }).click();
  await expect(page.getByText('Hai người.')).toBeVisible();

  await page.getByRole('button', { name: 'Xoá', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xoá' }).click();
  await page.waitForURL(/\/kaiwa$/);
  await expect(page.getByText('Chưa có kịch bản nào')).toBeVisible();
  if (shots)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: path.join(shots, `kaiwa-empty-${width}.png`) });
    }
});
