import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

async function swipe(page: Page, dx: number) {
  const card = page.getByRole('button', { name: /^Lật/ });
  const box = await card.boundingBox();
  if (!box) throw new Error('the card has no box — the deck did not render');
  const y = box.y + box.height / 2;
  const from = box.x + box.width / 2;
  await page.mouse.move(from, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(from + (dx * i) / 6, y);
  await page.mouse.up();
  await page.waitForTimeout(500);
}

test('/history can be studied as a deck, dealt from the filtered rows', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const sentence = db.prepare(
    `INSERT INTO Sentence (id, direction, context, exerciseType, sourceText, sourceRuby, userAnswer,
       suggested, suggestedRuby, feedback, score, stagedItems, extraPatterns, status, starred,
       createdAt, answeredAt)
     VALUES (?, ?, NULL, 'TRANSLATION', ?, NULL, ?, ?, NULL, ?, ?, NULL, NULL, ?, 0, ?, ?)`,
  );
  sentence.run(
    'h1',
    'VI_JA',
    'Tôi đã nắm được tình hình.',
    '状況を把握した。',
    '状況を把握しました。',
    'Đúng ý, nên dùng thể lịch sự.',
    82,
    'GRADED',
    iso(now),
    iso(now + 60_000),
  );
  sentence.run(
    'h2',
    'JA_VI',
    '曖昧な返事だった。',
    'Câu trả lời mơ hồ.',
    'Đó là một câu trả lời mơ hồ.',
    'Thiếu chủ ngữ.',
    70,
    'GRADED',
    iso(now - 1000),
    iso(now - 500),
  );
  sentence.run(
    'h3',
    'VI_JA',
    'Câu này chưa trả lời.',
    '',
    null,
    null,
    null,
    'PENDING',
    iso(now - 2000),
    null,
  );
  db.close();

  await login(page);
  await page.goto('/history', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Flashcard' }).click();

  await expect(page.getByText('Lượt 1 / 2')).toBeVisible();

  await expect(page.getByText('Tôi đã nắm được tình hình.')).toBeVisible();
  await page.getByRole('button', { name: /^Lật/ }).click();
  await expect(page.getByText('状況を把握しました。')).toBeVisible();
  await expect(page.getByText('Đúng ý, nên dùng thể lịch sự.')).toBeVisible();

  await swipe(page, -260);
  await expect(page.getByText('Lượt 2 / 2')).toBeVisible();
  await expect(page.getByText('曖昧な返事だった。')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lật xem mặt sau' })).toBeVisible();

  await expect(
    page.getByPlaceholder('Tìm trong đề / bài dịch…'),
    'ô tìm không còn ở chế độ thẻ',
  ).toHaveCount(0);

  const bar = page.getByRole('progressbar', { name: 'Tiến độ chồng thẻ' });
  await expect(bar).toBeVisible();
  const rowY = async (l: ReturnType<typeof page.locator>) => {
    const b = (await l.boundingBox())!;
    return b.y + b.height / 2;
  };
  const modeButton = page.getByRole('button', { name: 'Danh sách' });
  const settingsButton = page.getByRole('button', { name: 'Cài đặt' });
  const [barY, modeY, settingsY] = await Promise.all([
    rowY(bar),
    rowY(modeButton),
    rowY(settingsButton),
  ]);
  expect(Math.abs(barY - modeY), 'thanh tiến độ phải cùng hàng với các nút').toBeLessThanOrEqual(8);
  expect(Math.abs(settingsY - modeY), 'nút cài đặt cùng hàng với nút chế độ').toBeLessThanOrEqual(
    8,
  );

  const adjacent = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const mode = buttons.find((b) => b.textContent?.includes('Danh sách'));
    const settings = buttons.find((b) => b.textContent?.includes('Cài đặt'));
    if (!mode || !settings) return 'thiếu một trong hai nút';
    return mode.nextElementSibling === settings ? 'liền nhau' : 'có gì chen giữa';
  });
  expect(adjacent).toBe('liền nhau');

  await expect(page.getByRole('button', { name: /^Bộ lọc/ }), 'bộ lọc thuộc danh sách').toHaveCount(
    0,
  );

  await modeButton.click();
  await expect(page.getByRole('button', { name: 'Thẻ sau' })).toHaveCount(0);
  await expect(page.getByPlaceholder('Tìm trong đề / bài dịch…')).toBeVisible();

  await page.getByPlaceholder('Tìm trong đề / bài dịch…').fill('曖昧');
  await expect(page.getByText('1–1 / 1 lượt (lọc từ 3)')).toBeVisible();
  await page.getByRole('button', { name: 'Flashcard' }).click();
  await expect(page.getByText('Lượt 1 / 1')).toBeVisible();
  await expect(page.getByText('曖昧な返事だった。')).toBeVisible();

  await expect(page.getByRole('button', { name: /^(1 cột|2 cột)$/ })).toHaveCount(0);
});

test('the history deck fits a phone: nothing off-screen, and the arrows are reachable', async ({
  page,
}) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  db.prepare(
    `INSERT INTO Sentence (id, direction, context, exerciseType, sourceText, sourceRuby, userAnswer,
       suggested, suggestedRuby, feedback, score, stagedItems, extraPatterns, status, starred,
       createdAt, answeredAt)
     VALUES ('p2', 'VI_JA', NULL, 'TRANSLATION', 'Tôi buộc phải đi.', NULL, '行かざるを得ない。',
       '行かざるを得ません。', NULL, 'Dùng thể lịch sự sẽ hợp hơn.', 88, NULL, NULL, 'GRADED', 0, ?, ?)`,
  ).run(iso(now), iso(now + 1000));
  db.close();

  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  for (const [name, open] of [
    [
      'lịch sử',
      async () => {
        await page.goto('/history', { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: 'Flashcard' }).click();
      },
    ],
  ] as [string, () => Promise<void>][]) {
    await open();
    await expect(page.getByRole('button', { name: 'Thẻ sau' })).toBeVisible();

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const arrow = document.querySelector('button[aria-label="Thẻ sau"]')!.getBoundingClientRect();
      return {
        overflowX: de.scrollWidth - de.clientWidth,
        arrowBottom: Math.round(arrow.bottom),
        viewportH: de.clientHeight,
      };
    });
    expect(
      m.overflowX,
      `${name}: the deck widened the page by ${m.overflowX}px at 390px`,
    ).toBeLessThanOrEqual(1);
    expect(
      m.arrowBottom,
      `${name}: the nav arrows end at ${m.arrowBottom}px, past the ${m.viewportH}px fold`,
    ).toBeLessThanOrEqual(m.viewportH);
  }
});
