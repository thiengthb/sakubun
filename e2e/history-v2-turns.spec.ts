import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// History lists v2 turns beside old sentences: the turn shows its 1-4 grade instead of a 0-100
// score, opens to the same detail dialog, and carries no star (stars live on Sentence).

test('History shows a v2 turn with its grade beside an old sentence', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  for (const t of ['ReviewLog', 'Turn', 'Sentence', 'SrsState', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const now = Date.now();
  db.prepare(
    `INSERT INTO Sentence (id, direction, exerciseType, sourceText, suggested, userAnswer, score,
       createdAt, starred, status)
     VALUES ('s-old', 'JA_VI', 'TRANSLATION', '古い文を読みました。', 'Tôi đã đọc câu cũ.', 'Đọc câu cũ.', 80, ?, 0, 'GRADED')`,
  ).run(new Date(now - 3_600_000).toISOString());
  db.prepare(
    `INSERT INTO Turn (id, itemId, direction, ja, vi, status, answer, rating, feedback, createdAt, gradedAt)
     VALUES ('t-new', NULL, 'JA_VI', '音楽を聞きながら勉強します。', 'Tôi vừa nghe nhạc vừa học.',
             'graded', 'Tôi nghe nhạc và học.', 3, 'Đúng ý.', ?, ?)`,
  ).run(new Date(now - 60_000).toISOString(), new Date(now - 30_000).toISOString());
  db.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/history', { waitUntil: 'networkidle' });

  const cards = page.getByRole('listitem');
  const turnCard = cards.filter({ hasText: '音楽を聞きながら勉強します' });
  const oldCard = cards.filter({ hasText: '古い文を読みました' });
  await expect(turnCard).toHaveCount(1);
  await expect(oldCard).toHaveCount(1);
  // Newest first: the turn sits above the old sentence.
  const texts = await cards.allInnerTexts();
  const turnAt = texts.findIndex((t) => t.includes('音楽を聞きながら'));
  expect(turnAt).toBeLessThan(texts.findIndex((t) => t.includes('古い文を読みました')));

  await expect(turnCard.getByText('Good', { exact: true })).toBeVisible();
  await expect(turnCard.getByRole('button', { name: 'Đánh dấu sao', exact: true })).toHaveCount(0);
  await expect(oldCard.getByText('80/100')).toBeVisible();
  await expect(oldCard.getByRole('button', { name: 'Đánh dấu sao', exact: true })).toHaveCount(1);

  await turnCard.getByText('音楽を聞きながら勉強します').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Tôi nghe nhạc và học.')).toBeVisible();
  await expect(dialog.getByText('Tôi vừa nghe nhạc vừa học.')).toBeVisible();
});
