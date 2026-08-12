// NÚT NGHE KHÔNG BAO GIỜ ĐƯỢC MẮC Ở TRẠNG THÁI "ĐANG PHÁT".
//
// Người học báo 2026-08-12, Safari trên iPhone: "không có tiếng, nút quay mãi". Nguyên nhân là mọi
// đường thoát khỏi trạng thái đang-phát đều do SỰ KIỆN kéo — `onended`, `onerror`, hoặc `play()` bị từ
// chối. iOS Safari có một trạng thái không phát ra sự kiện nào trong ba: nó resolve `play()` rồi đơn
// giản không bao giờ bắt đầu phát. Không sự kiện nghĩa là không có gì hạ `speaking` xuống, nên spinner
// quay mãi và cách duy nhất ra là bấm lần hai — thứ đọc thành "dừng".
//
// Vì sao là e2e chứ không phải unit test: điều cần chốt là "trình duyệt không phát VÀ không báo lỗi",
// và đó là hành vi của một phần tử media thật trong một trình duyệt thật. Một mock của <audio> sẽ chỉ
// chốt lại đúng cái mock.
//
// Cảnh dựng ở đây là cảnh làm lộ ra lỗi mà không cần iOS: `/api/tts` nhận request rồi TREO. Trên iOS
// nguyên nhân là quyết định media; ở đây là byte không về. Cả hai để lại đúng một trạng thái —
// `play()` đã gọi, không sự kiện nào tới — và đó là trạng thái phải có đường ra.
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// Watchdog cho đường VOICEVOX là 9s (AUDIO_START_TIMEOUT_MS), nên một lượt đo cần hơn thế cộng thời
// gian đăng nhập + điều hướng. Vượt hẳn ngưỡng 60s toàn cục thay vì nâng ngưỡng đó cho mọi spec.
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
    `INSERT INTO Sentence (id, direction, exerciseType, sourceText, sourceRuby, suggested,
       suggestedRuby, userAnswer, feedback, score, context, createdAt, starred, status)
     VALUES ('s-stall', 'JA_VI', 'TRANSLATION', ?, ?, ?, NULL, ?, NULL, 80, 'đo loa', ?, 0, 'GRADED')`,
  ).run(
    '今、母は台所で料理をしています。',
    '今[いま]、母[はは]は台所[だいどころ]で料理[りょうり]をしています。',
    'Bây giờ mẹ đang nấu ăn trong bếp.',
    'Mẹ đang nấu ăn.',
    new Date().toISOString(),
  );
  db.close();

  // TREO, không phải lỗi. Một 503 sẽ đi vào nhánh `onerror` đã có đường thoát từ trước và chốt được
  // đúng cái nhánh KHÔNG hỏng — im lặng mới là cảnh cần dựng.
  await page.route('**/api/tts**', () => {
    /* không bao giờ fulfill */
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/history');

  // KHÔNG dùng getByRole cho nút này: thẻ lịch sử là role=button và tên của nó được tính TỪ NỘI DUNG,
  // nên nó cũng khớp /phát âm/ — bấm vào giữa thẻ (358x114) thay vì vào nút 24x24, và phép đo sẽ nói
  // về một thứ khác hoàn toàn (mất một vòng vì đúng chuyện này, 2026-08-12).
  const speak = page.locator('button[aria-label*="phát âm"]').first();
  await expect(speak).toBeVisible();
  await speak.click();

  // Đang phát: aria-label đổi sang "Dừng phát". Đây là trạng thái được phép — chỉ là không được VĨNH VIỄN.
  const playing = page.getByRole('button', { name: 'Dừng phát' });
  await expect(playing.first(), 'bấm xong thì nút vào trạng thái đang phát').toBeVisible();

  // …và phải tự ra, không cần ai bấm gì thêm. Đây là toàn bộ nội dung của bản sửa.
  await expect(playing, 'nút phải tự thoát trạng thái đang phát khi không có gì phát được').toHaveCount(
    0,
    { timeout: 30_000 },
  );
  await expect(speak, 'và trở lại là một nút bấm được').toBeVisible();
});
