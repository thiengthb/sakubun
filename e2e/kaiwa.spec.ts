import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// Phase 8, K3 and K4 (view redo 7.4e): a script Claude saved over MCP shows on Hội thoại; its page
// reads it as a chat from the part the learner picks, hides the Vietnamese or the learner's own lines
// on request, and deletes it after a confirm.
const BODY = [
  '店の中は静かだった。 | Trong quán yên tĩnh.',
  'A: いらっしゃいませ。何名様[なんめいさま]ですか。 | Xin mời vào. Quý khách đi mấy người ạ?',
  'B: 二人[ふたり]です。 | Hai người.',
  'A: こちらへどうぞ。 | Mời đi lối này.',
].join('\n');
// What a save stores (K4): the author's furigana where they wrote it, readings worked out elsewhere.
// The scene line carries its words (K5), as the tokenizer gives them.
const SCENE_TOKENS = [
  { surface: '店', reading: 'みせ', pos: '名詞' },
  { surface: 'の', pos: '助詞' },
  { surface: '中', reading: 'なか', pos: '名詞' },
  { surface: 'は', pos: '助詞' },
  { surface: '静か', reading: 'しずか', pos: '名詞' },
  { surface: 'だっ', base: 'だ', pos: '助動詞' },
  { surface: 'た', pos: '助動詞' },
  { surface: '。', pos: '記号' },
];
const ANALYSIS = JSON.stringify({
  v: 1,
  lines: [
    '店[みせ]の中[なか]は静[しず]かだった。',
    'いらっしゃいませ。何名様[なんめいさま]ですか。',
    '二人[ふたり]です。',
    'こちらへどうぞ。',
  ].map((ruby, i) => ({ ruby, tokens: i === 0 ? SCENE_TOKENS : [] })),
});

function db() {
  return new Database(path.join(process.cwd(), E2E_DB_FILE));
}

/** The centre of a character of a line's sentence, as drawn. */
async function charAt(page: Page, line: number, ch: string) {
  const box = await page.evaluate(
    ([n, c]) => {
      const root = document
        .querySelectorAll('[data-slot="kaiwa-line"]')
        [n].querySelector('[data-lookup]')!;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const i = (t as Text).data.indexOf(c);
        if (i === -1 || t.parentElement?.closest('rt')) continue;
        const range = document.createRange();
        range.setStart(t, i);
        range.setEnd(t, i + 1);
        const r = range.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return null;
    },
    [line, ch] as const,
  );
  expect(box).not.toBeNull();
  return box!;
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test('Hội thoại lists a saved script and its page reads it line by line', async ({ page }) => {
  await seedE2eAccount();
  const d = db();
  d.exec(`DELETE FROM Script WHERE userId = ${E2E_OWNER}`);
  // 店 is the learner's own word; 静か only OpenJLPT's.
  d.pragma('foreign_keys = ON');
  d.exec(`DELETE FROM Item WHERE userId = ${E2E_OWNER} AND expression IN ('店', '静か')`);
  d.prepare(
    `INSERT INTO Item (id, userId, kind, expression, reading, meaningVi, level, source, createdAt)
     VALUES ('kw-mise', ${E2E_OWNER}, 'VOCAB', '店', 'みせ', 'cửa hàng (kho riêng)', 'N5', 'MANUAL', ?)`,
  ).run(new Date().toISOString());
  d.prepare(
    `INSERT INTO Script (id, userId, title, body, analysis, version, createdAt, updatedAt)
     VALUES ('kw-e2e', ${E2E_OWNER}, 'Ở nhà hàng', ?, ?, 1, ?, ?)`,
  ).run(BODY, ANALYSIS, new Date().toISOString(), new Date().toISOString());
  d.close();

  await signIn(page);

  await page.goto('/kaiwa', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Hội thoại' })).toBeVisible();
  await expect(page.getByText('1 kịch bản')).toBeVisible();
  await page.getByRole('link', { name: 'Mở Ở nhà hàng' }).click();
  await page.waitForURL(/\/kaiwa\/kw-e2e$/);

  const lines = page.locator('[data-slot="kaiwa-line"]');
  await expect(lines).toHaveCount(4);
  // The speaker's name heads each run in small type; the scene has none.
  await expect(lines.nth(1).locator('[data-slot="kaiwa-speaker"]')).toHaveText('A');
  await expect(lines.nth(3).locator('[data-slot="kaiwa-speaker"]')).toHaveText('A');
  await expect(lines.first().locator('[data-slot="kaiwa-speaker"]')).toHaveCount(0);
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
    (await lines.nth(i).locator('[data-slot="kaiwa-speaker"]').boundingBox())!.x;
  expect(await leftOf(1)).toBeLessThan(await leftOf(2));
  // The speaker button stands beside the bubble, on its empty side.
  const bubbleRight = await lines
    .nth(1)
    .locator('[data-lookup]')
    .evaluate((el) => el.closest('div')!.getBoundingClientRect().right);
  const speakLeft = (await lines.nth(1).getByRole('button', { name: 'Nghe câu' }).boundingBox())!.x;
  expect(speakLeft).toBeGreaterThanOrEqual(bubbleRight);

  // The shared lookup (7.4b): resting the mouse on a word shows its meaning, the learner's own
  // first.
  const card = page.locator('[data-slot="word-card"]');
  await expect
    .poll(() => page.evaluate(() => CSS.highlights.get('word-lookup')?.size ?? 0))
    .toBeGreaterThan(0);
  const shop = await charAt(page, 0, '店');
  await page.mouse.move(shop.x, shop.y);
  await expect(card).toContainText('cửa hàng (kho riêng)');
  await expect(card.getByRole('link', { name: 'Đã có trong kho của bạn' })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(card).toBeHidden();
  const quiet = await charAt(page, 0, '静');
  await page.mouse.move(quiet.x, quiet.y);
  await expect(card).toContainText('yên tĩnh');
  await card.getByRole('button', { name: 'Thêm vào kho' }).click();
  await expect(page.getByText('Đã thêm 静か vào kho')).toBeVisible();
  await expect(card.getByRole('link', { name: 'Đã có trong kho của bạn' })).toBeVisible();
  const shots = process.env.SCREENSHOT_DIR;
  if (shots) {
    await page.screenshot({ path: path.join(shots, 'kaiwa-word-1440.png') });
  }
  await page.mouse.move(0, 0);

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

  const hide = page.getByRole('button', { name: 'Ẩn nghĩa' });
  await hide.click();
  await expect(hide).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Hai người.')).toHaveCount(0);
  await hide.click();
  await expect(page.getByText('Hai người.')).toBeVisible();

  // "Che câu của tôi": A's lines show their meaning until tapped; B's stay as they are.
  await page.getByRole('button', { name: 'Che câu của tôi' }).click();
  const covered = page.locator('[data-slot="kaiwa-covered"]');
  await expect(covered).toHaveCount(2);
  await expect(lines.nth(1)).not.toContainText('いらっしゃいませ');
  await expect(lines.nth(1)).toContainText('Bấm để xem câu tiếng Nhật');
  await expect(lines.nth(2)).toContainText('二人');
  await covered.first().click();
  await expect(lines.nth(1)).toContainText('いらっしゃいませ');
  await expect(covered).toHaveCount(1);
  await page.getByRole('button', { name: 'Che câu của tôi' }).click();
  await expect(covered).toHaveCount(0);

  // The page's keys sit behind the `?`; ↑ ↓ choose a line and Ctrl E opens the editor.
  await page.getByRole('button', { name: 'Phím tắt' }).hover();
  await expect(page.locator('[data-slot="shortcuts"]')).toContainText('Sửa kịch bản');
  await page.mouse.move(0, 0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(lines.nth(1).locator('.ring-2')).toHaveCount(1);
  await page.keyboard.press('Control+e');
  await page.waitForURL(/\/kaiwa\/kw-e2e\/edit$/);
  await page.goBack();
  await page.waitForURL(/\/kaiwa\/kw-e2e$/);

  await page.getByRole('link', { name: 'Sửa', exact: true }).click();
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

// K3c: the web editor writes the same format, checks it while typing, and refuses to overwrite a
// version the AI saved meanwhile.
test('a script is written and fixed on the web too', async ({ page }) => {
  await seedE2eAccount();
  const d = db();
  d.exec(`DELETE FROM Script WHERE userId = ${E2E_OWNER}`);
  d.close();
  await signIn(page);

  await page.goto('/kaiwa', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Thêm' }).click();
  await page.waitForURL(/\/kaiwa\/new$/);
  const save = page.getByRole('button', { name: 'Thêm kịch bản' });
  await expect(save).toBeDisabled();

  await page.getByLabel('Tiêu đề').fill('Ở ga');
  await page.getByLabel('Kịch bản').fill('A: hello | xin chào');
  await expect(page.getByText(/^Dòng 1: Không có chữ Nhật/)).toBeVisible();
  await expect(save).toBeDisabled();

  await page
    .getByLabel('Kịch bản')
    .fill('A: 切符はどこで買えますか。 | Mua vé ở đâu ạ?\nB: あちらです。 | Ở đằng kia.');
  await expect(page.getByText('2 câu · Người nói: A, B')).toBeVisible();
  await save.click();
  await page.waitForURL(/\/kaiwa\/(?!new)[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Ở ga' })).toBeVisible();
  await expect(page.locator('[data-slot="kaiwa-line"]')).toHaveCount(2);
  const id = new URL(page.url()).pathname.split('/').pop()!;

  await page.getByRole('link', { name: 'Sửa', exact: true }).click();
  await page.waitForURL(/\/edit$/);
  await expect(page.getByLabel('Tiêu đề')).toHaveValue('Ở ga');
  // The AI saves a new version while the learner is editing.
  const d2 = db();
  d2.prepare('UPDATE Script SET version = version + 1 WHERE id = ?').run(id);
  d2.close();
  await page.getByLabel('Tiêu đề').fill('Ở nhà ga');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText(/Kịch bản đã được sửa sau lần bạn đọc/)).toBeVisible();

  await page.reload();
  await page.getByLabel('Tiêu đề').fill('Ở nhà ga');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await page.waitForURL(new RegExp(`/kaiwa/${id}$`));
  await expect(page.getByRole('heading', { name: 'Ở nhà ga' })).toBeVisible();

  const shots = process.env.SCREENSHOT_DIR;
  if (shots) {
    await page.goto(`/kaiwa/${id}/edit`, { waitUntil: 'networkidle' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: path.join(shots, `kaiwa-edit-${width}.png`), fullPage: true });
    }
  }
});

// thien, 7.4: a new script starts from the part the learner took last, when it has that name.
test('"Tôi là" carries the last part over to a script with the same name', async ({ page }) => {
  await seedE2eAccount();
  const d = db();
  d.exec(`DELETE FROM Script WHERE userId = ${E2E_OWNER}`);
  const insert = d.prepare(
    `INSERT INTO Script (id, userId, title, body, analysis, version, createdAt, updatedAt)
     VALUES (?, ${E2E_OWNER}, ?, ?, NULL, 1, ?, ?)`,
  );
  const now = new Date().toISOString();
  insert.run(
    'kw-one',
    'Bài một',
    'A: こんにちは。 | Chào.\nグエン: こんにちは。 | Chào.',
    now,
    now,
  );
  insert.run('kw-two', 'Bài hai', '店員: どうぞ。 | Mời.\nグエン: どうも。 | Cảm ơn.', now, now);
  insert.run('kw-three', 'Bài ba', 'X: はい。 | Vâng.\nY: いいえ。 | Không.', now, now);
  d.close();
  await signIn(page);

  await page.goto('/kaiwa/kw-one', { waitUntil: 'networkidle' });
  await expect(page.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'グエン' }).click();

  await page.goto('/kaiwa/kw-two', { waitUntil: 'networkidle' });
  await expect(page.getByRole('radio', { name: 'グエン' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-slot="kaiwa-line"]').nth(1)).toHaveAttribute(
    'data-side',
    'mine',
  );
  // No グエン here: the first speaker, as before.
  await page.goto('/kaiwa/kw-three', { waitUntil: 'networkidle' });
  await expect(page.getByRole('radio', { name: 'X' })).toHaveAttribute('aria-checked', 'true');
});
