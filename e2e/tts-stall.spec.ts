import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

test.setTimeout(120_000);

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test('TTS treo thì nút tự thoát khỏi trạng thái đang phát, không quay mãi', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  for (const t of ['ReviewLog', 'Sentence', 'SrsState', 'Item']) db.exec(`DELETE FROM "${t}"`);
  db.prepare(
    `INSERT INTO Sentence (userId, id, direction, exerciseType, sourceText, sourceRuby, suggested,
       suggestedRuby, userAnswer, feedback, score, context, createdAt, starred, status)
     VALUES (${E2E_OWNER}, 's-stall', 'JA_VI', 'TRANSLATION', ?, ?, ?, NULL, ?, NULL, 80, 'đo loa', ?, 0, 'GRADED')`,
  ).run(
    '今、母は台所で料理をしています。',
    '今[いま]、母[はは]は台所[だいどころ]で料理[りょうり]をしています。',
    'Bây giờ mẹ đang nấu ăn trong bếp.',
    'Mẹ đang nấu ăn.',
    new Date().toISOString(),
  );
  db.close();

  await page.route('**/api/tts**', () => {});

  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/history');

  const speak = page.locator('button[aria-label*="phát âm"]').first();
  await expect(speak).toBeVisible();
  await speak.click();

  const playing = page.getByRole('button', { name: 'Dừng phát' });
  await expect(playing.first(), 'bấm xong thì nút vào trạng thái đang phát').toBeVisible();

  await expect(
    playing,
    'nút phải tự thoát trạng thái đang phát khi không có gì phát được',
  ).toHaveCount(0, { timeout: 30_000 });
  await expect(speak, 'và trở lại là một nút bấm được').toBeVisible();
});
