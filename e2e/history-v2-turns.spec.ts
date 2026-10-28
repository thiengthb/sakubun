import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// History lists v2 turns beside old sentences: the turn shows its 1-4 grade instead of a 0-100
// score, opens in the same detail panel, and carries no star (stars live on Sentence).

test('History shows a v2 turn with its grade beside an old sentence', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  for (const t of ['ReviewLog', 'Turn', 'Sentence', 'SrsState', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const now = Date.now();
  db.prepare(
    `INSERT INTO Sentence (userId, id, direction, exerciseType, sourceText, suggested, userAnswer, score,
       createdAt, starred, status)
     VALUES (${E2E_OWNER}, 's-old', 'JA_VI', 'TRANSLATION', '古い文を読みました。', 'Tôi đã đọc câu cũ.', 'Đọc câu cũ.', 80, ?, 0, 'GRADED')`,
  ).run(new Date(now - 3_600_000).toISOString());
  db.prepare(
    `INSERT INTO Turn (userId, id, itemId, direction, ja, vi, status, answer, rating, feedback, createdAt, gradedAt)
     VALUES (${E2E_OWNER}, 't-new', NULL, 'JA_VI', '音楽を聞きながら勉強します。', 'Tôi vừa nghe nhạc vừa học.',
             'graded', 'Tôi nghe nhạc và học.', 3, 'Đúng ý.', ?, ?)`,
  ).run(new Date(now - 60_000).toISOString(), new Date(now - 30_000).toISOString());
  db.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/history', { waitUntil: 'networkidle' });

  // One row per turn on the timeline (thien, 7.4 History B).
  const rows = page.locator('[data-history-row]');
  const turnRow = rows.filter({ hasText: '音楽を聞きながら勉強します' });
  const oldRow = rows.filter({ hasText: '古い文を読みました' });
  await expect(turnRow).toHaveCount(1);
  await expect(oldRow).toHaveCount(1);
  // Newest first: the turn sits above the old sentence.
  const texts = await rows.allInnerTexts();
  const turnAt = texts.findIndex((t) => t.includes('音楽を聞きながら'));
  expect(turnAt).toBeLessThan(texts.findIndex((t) => t.includes('古い文を読みました')));

  await expect(turnRow.getByText('Good', { exact: true })).toBeVisible();
  // A score is the bare number; its scale is one hover away.
  await expect(oldRow.getByText('80', { exact: true })).toBeVisible();
  await oldRow.getByText('80', { exact: true }).hover();
  await expect(page.getByRole('tooltip').getByText('80/100')).toBeVisible();
  // The star moved into the detail panel.
  await expect(
    page.locator('main').getByRole('button', { name: 'Đánh dấu sao', exact: true }),
  ).toHaveCount(0);

  await turnRow.getByText('Good', { exact: true }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByText('Tôi nghe nhạc và học.')).toBeVisible();
  await expect(panel.getByText('Tôi vừa nghe nhạc vừa học.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Đánh dấu sao', exact: true })).toHaveCount(0);
  // Another row shows its turn in the same panel; an old sentence carries its star there.
  await oldRow.getByText('80', { exact: true }).click();
  await expect(panel.getByText('Đọc câu cũ.', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Đánh dấu sao', exact: true })).toHaveCount(1);
});

test('History loads more turns as it scrolls at every width, and a new search starts over', async ({
  page,
}) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  for (const t of ['ReviewLog', 'Turn', 'Sentence', 'SrsState', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const insert = db.prepare(
    `INSERT INTO Sentence (userId, id, direction, exerciseType, sourceText, suggested, userAnswer, score,
       createdAt, starred, status)
     VALUES (${E2E_OWNER}, ?, 'VI_JA', 'TRANSLATION', ?, '答え', 'こたえ', 70, ?, 0, 'GRADED')`,
  );
  const now = Date.now();
  for (let i = 0; i < 30; i++)
    insert.run(`s${i}`, `Câu số ${i}`, new Date(now - i * 60_000).toISOString());
  db.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/history', { waitUntil: 'networkidle' });

  const rows = page.locator('[data-history-row]');
  await expect(rows).toHaveCount(20);
  await expect(page.getByRole('navigation', { name: 'Phân trang' })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => rows.count()).toBe(30);

  // A new search is a new list: the first rows again.
  await page.getByPlaceholder('Tìm trong đề / bài dịch…').fill('Câu số 1');
  await expect(rows).toHaveCount(11);
  await expect(rows.first()).toContainText('Câu số 1');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('every History row is the same height, a waiting one included', async ({ page }) => {
    await seedE2eAccount();
    const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
    for (const t of ['ReviewLog', 'Turn', 'Sentence', 'SrsState', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    const now = Date.now();
    const insert = db.prepare(
      `INSERT INTO Sentence (userId, id, direction, exerciseType, sourceText, suggested, userAnswer, score,
         createdAt, answeredAt, starred, status)
       VALUES (${E2E_OWNER}, ?, ?, ?, ?, 'x', 'y', ?, ?, ?, 0, ?)`,
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
    db.close();

    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
    await page.goto('/history', { waitUntil: 'networkidle' });

    const rows = page.locator('[data-history-row]');
    await expect(rows).toHaveCount(3);
    const heights = await rows.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size, `row heights ${heights.join(', ')}`).toBe(1);
    // The waiting row keeps how to answer behind a hover, not as a paragraph.
    await expect(page.getByText('Trả lời qua Claude Desktop')).toHaveCount(0);
    await page.getByRole('button', { name: 'Đang chờ' }).hover();
    await expect(page.getByRole('tooltip').getByText(/Trả lời qua Claude Desktop/)).toBeVisible();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('History is a timeline that loads more as it scrolls, and a row opens its detail', async ({
    page,
  }) => {
    await seedE2eAccount();
    const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
    for (const t of ['ReviewLog', 'Turn', 'Sentence', 'SrsState', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    const insert = db.prepare(
      `INSERT INTO Sentence (userId, id, direction, exerciseType, sourceText, suggested, userAnswer, score,
         createdAt, starred, status)
       VALUES (${E2E_OWNER}, ?, 'VI_JA', 'TRANSLATION', ?, '答え', 'こたえ', 70, ?, 0, 'GRADED')`,
    );
    const now = Date.now();
    // One very long prompt: it must cut off inside its row, not widen the page.
    insert.run(
      'long',
      'Mặc dù bản báo cáo này nhất định phải nộp trước cuộc họp tuần sau nhưng tôi mới viết được một nửa',
      new Date(now + 1000).toISOString(),
    );
    for (let i = 0; i < 29; i++)
      insert.run(`s${i}`, `Câu số ${i}`, new Date(now - i * 60_000).toISOString());
    db.close();

    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
    await page.goto('/history', { waitUntil: 'networkidle' });

    const rows = page.locator('[data-history-row]');
    await expect(rows).toHaveCount(20);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => rows.count()).toBe(30);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      'a long prompt never scrolls the page sideways',
    ).toBeLessThanOrEqual(0);

    await rows
      .filter({ hasText: 'Câu số 3' })
      .first()
      .getByText('Câu số 3', { exact: true })
      .click();
    await expect(page.getByRole('dialog').getByText('こたえ')).toBeVisible();
  });
});
