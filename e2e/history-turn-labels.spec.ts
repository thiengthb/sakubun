// THẺ LỊCH SỬ PHẢI GỌI ĐÚNG TÊN VIỆC NGƯỜI HỌC ĐÃ LÀM.
//
// Cùng một lỗi đã được sửa BA lần ở khối chat (teach-back 2026-07-27, quiz và hội thoại 2026-08-12), mỗi
// lần bằng cách thêm một cờ `isX` — và lần thứ tư vẫn còn nguyên ở đây, vì web giữ BẢN SAO nhãn riêng:
// `Đề` / `Bạn dịch:` / `Tham khảo:` in cứng cho mọi kiểu luyện, ngay cạnh một badge ghi "Quiz" hoặc
// "Giảng lại". Hai bản sao của một phép ánh xạ là một bản sẽ bị quên.
//
// Vì sao là e2e chứ không chỉ unit test: `lib/turn-labels.test.ts` chốt cái BẢNG, còn cái từng sai là
// việc trang này có ĐỌC bảng đó hay không. Chỉ trang render thật trả lời được câu đó.
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
  // Ba lượt, mới nhất trước — mỗi cái là một kiểu luyện mà người học KHÔNG dịch gì cả.
  const rows = [
    ['s-quiz', 'JA_VI', 'QUIZ', 'ここで写真を撮っ（＿＿）か。', '〜てもいいです (C)', 'Chọn C', 0, 'quiz'],
    ['s-tb', 'JA_VI', 'TEACH_BACK', '〜たことがあります', 'Mẫu này nói về kinh nghiệm.', 'Là đã từng làm gì', 85, 'giảng lại'],
    ['s-cv', 'VI_JA', 'CONVERSATION', 'Bối cảnh: gọi cho cấp trên. Bạn cần: xin đến muộn.', '申し訳ございません。', 'すみません。', 70, 'hội thoại'],
  ] as const;
  rows.forEach((r, i) =>
    insert.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], new Date(Date.now() - i * 60_000).toISOString()),
  );
  db.close();

  await login(page);
  await page.goto('/history');

  // Mở từng thẻ và đọc nhãn trong modal chi tiết — đó là nơi cả ba dòng cùng xuất hiện.
  const cases = [
    { open: 'ここで写真を撮っ', prompt: 'Câu hỏi', answer: 'Bạn chọn', reference: 'Đáp án' },
    { open: '〜たことがあります', prompt: 'Mẫu', answer: 'Bạn giảng', reference: 'Tham khảo' },
    { open: 'Bối cảnh: gọi cho cấp trên', prompt: 'Tình huống', answer: 'Bạn nói', reference: 'Câu mẫu' },
  ];
  for (const c of cases) {
    await page.getByText(c.open, { exact: false }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // `exact: true` cho cả ba: đây là các NHÃN, và một nhãn khớp lỏng sẽ khớp luôn cả phần NỘI DUNG
    // chứa cùng cụm chữ — lần đầu viết lỏng thì "Đáp án:" khớp hai phần tử và Playwright đỏ vì
    // strict mode, tức là phép đo hỏng chứ không phải trang hỏng.
    await expect(dialog.getByText(c.prompt, { exact: true })).toBeVisible();
    await expect(dialog.getByText(`${c.answer}:`, { exact: true })).toBeVisible();
    await expect(dialog.getByText(`${c.reference}:`, { exact: true })).toBeVisible();
    // …và KHÔNG được nói người học đã dịch, khi họ không dịch.
    await expect(dialog.getByText('Bạn dịch:', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});
