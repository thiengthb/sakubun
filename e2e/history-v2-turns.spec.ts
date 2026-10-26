import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, ownSeedRows, seedE2eAccount } from './fixtures';

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
  ownSeedRows(db);
  db.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/history', { waitUntil: 'networkidle' });

  // Cards on every width (thien, Lịch sử round 1), in pages from 1024px: one card per turn.
  const cards = page.locator('[data-slot="history-cards"][data-layout="pages"] > li');
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
  // A score is the bare number; its scale is one hover away.
  await expect(oldCard.getByText('80', { exact: true })).toBeVisible();
  await oldCard.getByText('80', { exact: true }).hover();
  await expect(page.getByRole('tooltip').getByText('80/100')).toBeVisible();
  await expect(oldCard.getByRole('button', { name: 'Đánh dấu sao', exact: true })).toHaveCount(1);

  await turnCard.getByText('音楽を聞きながら勉強します').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Tôi nghe nhạc và học.')).toBeVisible();
  await expect(dialog.getByText('Tôi vừa nghe nhạc vừa học.')).toBeVisible();
});

test('from 1024px History comes in pages of cards, and a new search starts at page 1', async ({
  page,
}) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  for (const t of ['ReviewLog', 'Turn', 'Sentence', 'SrsState', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const insert = db.prepare(
    `INSERT INTO Sentence (id, direction, exerciseType, sourceText, suggested, userAnswer, score,
       createdAt, starred, status)
     VALUES (?, 'VI_JA', 'TRANSLATION', ?, '答え', 'こたえ', 70, ?, 0, 'GRADED')`,
  );
  const now = Date.now();
  for (let i = 0; i < 30; i++)
    insert.run(`s${i}`, `Câu số ${i}`, new Date(now - i * 60_000).toISOString());
  ownSeedRows(db);
  db.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/history', { waitUntil: 'networkidle' });

  const cards = page.locator('[data-slot="history-cards"][data-layout="pages"] > li');
  const pages = page.getByRole('navigation', { name: 'Phân trang' });
  // A page fills the window with whole rows of cards, and the pager rests 32px above its bottom.
  await expect(pages).toBeVisible();
  const fitted = await cards.count();
  const perRow = await page
    .locator('[data-slot="history-cards"][data-layout="pages"]')
    .evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(' ').length);
  expect(fitted % perRow, `${fitted} cards make whole rows of ${perRow}`).toBe(0);
  expect(fitted / perRow).toBeGreaterThanOrEqual(2);
  const gap = await pages.evaluate((nav) => {
    const box = nav.closest('div[class*="max-lg:hidden"]')!.getBoundingClientRect();
    return window.innerHeight - box.bottom;
  });
  expect(
    Math.abs(gap - 32),
    `the pager sits ${gap}px above the window's bottom`,
  ).toBeLessThanOrEqual(2);

  // A chosen size replaces the fit.
  await page.getByRole('combobox', { name: 'Số dòng' }).click();
  await page.getByRole('option', { name: '12', exact: true }).click();
  await expect(cards).toHaveCount(12);
  await expect(page.getByText('1–12 / 30 lượt')).toBeVisible();
  await pages.getByRole('button', { name: 'Trang 3', exact: true }).click();
  await expect(cards).toHaveCount(6);
  await expect(cards.first()).toContainText('Câu số 24');

  // Every turn still matches, but a new search is a new list: back to page 1.
  await page.getByPlaceholder('Tìm trong đề / bài dịch…').fill('Câu số');
  await expect(cards).toHaveCount(12);
  await expect(cards.first()).toContainText('Câu số 0');

  // One page needs no footer.
  await page.getByPlaceholder('Tìm trong đề / bài dịch…').fill('Câu số 1');
  await expect(cards).toHaveCount(11);
  await expect(pages).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('every History card is the same height, a waiting one included', async ({ page }) => {
    await seedE2eAccount();
    const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
    for (const t of ['ReviewLog', 'Turn', 'Sentence', 'SrsState', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    const now = Date.now();
    const insert = db.prepare(
      `INSERT INTO Sentence (id, direction, exerciseType, sourceText, suggested, userAnswer, score,
         createdAt, answeredAt, starred, status)
       VALUES (?, ?, ?, ?, 'x', 'y', ?, ?, ?, 0, ?)`,
    );
    const at = (i: number) => new Date(now - i * 60_000).toISOString();
    insert.run(
      'p',
      'JA_VI',
      'TRANSLATION',
      '音楽を聞きながら勉強します。',
      null,
      at(0),
      null,
      'PENDING',
    );
    insert.run(
      'g',
      'JA_VI',
      'GUIDED_PRODUCTION',
      '日本語が話せるようになりました。',
      88,
      at(1),
      at(0),
      'GRADED',
    );
    insert.run(
      'v',
      'VI_JA',
      'TEACH_BACK',
      'Dù bận, anh ấy vẫn giúp tôi.',
      null,
      at(2),
      at(1),
      'SKIPPED',
    );
    ownSeedRows(db);
    db.close();

    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
    await page.goto('/history', { waitUntil: 'networkidle' });

    const cards = page.locator('[data-slot="history-cards"][data-layout="scroll"] > li');
    await expect(cards).toHaveCount(3);
    const heights = await cards.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size, `card heights ${heights.join(', ')}`).toBe(1);
    // The waiting card keeps how to answer behind a hover, not as a paragraph.
    await expect(page.getByText('Trả lời qua Claude Desktop')).toHaveCount(0);
    await page.getByRole('button', { name: 'Đang chờ' }).hover();
    await expect(page.getByRole('tooltip').getByText(/Trả lời qua Claude Desktop/)).toBeVisible();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('History is a card list that loads more as it scrolls, and a card opens its detail', async ({
    page,
  }) => {
    await seedE2eAccount();
    const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
    for (const t of ['ReviewLog', 'Turn', 'Sentence', 'SrsState', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    const insert = db.prepare(
      `INSERT INTO Sentence (id, direction, exerciseType, sourceText, suggested, userAnswer, score,
         createdAt, starred, status)
       VALUES (?, 'VI_JA', 'TRANSLATION', ?, '答え', 'こたえ', 70, ?, 0, 'GRADED')`,
    );
    const now = Date.now();
    // One very long prompt: it must cut off inside its card, not widen the page.
    insert.run(
      'long',
      'Mặc dù bản báo cáo này nhất định phải nộp trước cuộc họp tuần sau nhưng tôi mới viết được một nửa',
      new Date(now + 1000).toISOString(),
    );
    for (let i = 0; i < 29; i++)
      insert.run(`s${i}`, `Câu số ${i}`, new Date(now - i * 60_000).toISOString());
    ownSeedRows(db);
    db.close();

    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
    await page.goto('/history', { waitUntil: 'networkidle' });

    const cards = page.locator('[data-slot="history-cards"][data-layout="scroll"] > li');
    await expect(cards).toHaveCount(20);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => cards.count()).toBe(30);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      'a long prompt never scrolls the page sideways',
    ).toBeLessThanOrEqual(0);

    await cards
      .filter({ hasText: 'Câu số 3' })
      .first()
      .getByText('Câu số 3', { exact: true })
      .click();
    await expect(page.getByRole('dialog').getByText('こたえ')).toBeVisible();
  });
});
