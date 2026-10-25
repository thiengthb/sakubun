import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test('mỗi kiểu luyện được gọi đúng tên trên thẻ lịch sử', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  for (const t of ['ReviewLog', 'Sentence', 'SrsState', 'Item']) db.exec(`DELETE FROM "${t}"`);
  const insert = db.prepare(
    `INSERT INTO Sentence (id, direction, exerciseType, sourceText, sourceRuby, suggested,
       suggestedRuby, userAnswer, feedback, score, context, createdAt, starred, status)
     VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, NULL, ?, ?, ?, 0, 'GRADED')`,
  );
  const rows = [
    [
      's-quiz',
      'JA_VI',
      'QUIZ',
      'ここで写真を撮っ（＿＿）か。',
      '〜てもいいです (C)',
      'Chọn C',
      0,
      'quiz',
    ],
    [
      's-tb',
      'JA_VI',
      'TEACH_BACK',
      '〜たことがあります',
      'Mẫu này nói về kinh nghiệm.',
      'Là đã từng làm gì',
      85,
      'giảng lại',
    ],
    [
      's-cv',
      'VI_JA',
      'CONVERSATION',
      'Bối cảnh: gọi cho cấp trên. Bạn cần: xin đến muộn.',
      '申し訳ございません。',
      'すみません。',
      70,
      'hội thoại',
    ],
  ] as const;
  rows.forEach((r, i) =>
    insert.run(
      r[0],
      r[1],
      r[2],
      r[3],
      r[4],
      r[5],
      r[6],
      r[7],
      new Date(Date.now() - i * 60_000).toISOString(),
    ),
  );
  db.close();

  await login(page);
  await page.goto('/history');

  const cases = [
    { open: 'ここで写真を撮っ', prompt: 'Câu hỏi', answer: 'Bạn chọn', reference: 'Đáp án' },
    { open: '〜たことがあります', prompt: 'Mẫu', answer: 'Bạn giảng', reference: 'Tham khảo' },
    {
      open: 'Bối cảnh: gọi cho cấp trên',
      prompt: 'Tình huống',
      answer: 'Bạn nói',
      reference: 'Câu mẫu',
    },
  ];
  for (const c of cases) {
    // A click on the card opens its detail (the phone's scroll list shares the DOM, hidden).
    await page.getByText(c.open, { exact: false }).filter({ visible: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(c.prompt, { exact: true })).toBeVisible();
    await expect(dialog.getByText(`${c.answer}:`, { exact: true })).toBeVisible();
    await expect(dialog.getByText(`${c.reference}:`, { exact: true })).toBeVisible();
    await expect(dialog.getByText('Bạn dịch:', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});
