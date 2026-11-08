import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// KJ3 (docs/plans/2026-11-08-kanji.md › Học một chữ): Ôn nhanh brings in new kanji itself, the kanji
// of the words being learned first, and tests a kanji by its glyph alone: the back gives the Hán
// Việt, the meaning, the readings and the learner's words that use it.

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

function seed({ dueKanji }: { dueKanji: boolean }) {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  try {
    for (const t of [
      'GroupMember',
      'Group',
      'ReviewLog',
      'SrsState',
      'Sentence',
      'Item',
      'Settings',
    ])
      db.exec(`DELETE FROM "${t}"`);
    const settings = dueKanji
      ? { dailyNewKanji: 0, dailyNewVocab: 0, dailyNewGrammar: 0 }
      : { dailyNewKanji: 1, dailyNewVocab: 0, dailyNewGrammar: 0 };
    db.prepare(`INSERT INTO Settings (userId, data, updatedAt) VALUES (${E2E_OWNER}, ?, ?)`).run(
      JSON.stringify(settings),
      iso(now),
    );
    const item = db.prepare(
      `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, source, suspended, starred, createdAt)
       VALUES (${E2E_OWNER}, ?, ?, ?, ?, ?, ?, ?, 'MCP', 0, 0, ?)`,
    );
    const srs = db.prepare(
      `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays, learningSteps,
         reps, lapses, state, lastReview)
       VALUES (${E2E_OWNER}, ?, ?, ?, 4, 5, 3, 0, ?, 0, ?, ?)`,
    );
    // 経済 is being learned and comes back in a week, so its 経 is the first kanji brought in.
    item.run('w1', 'VOCAB', '経済', 'けいざい', null, 'kinh tế', 'N3', iso(now - 4 * DAY));
    srs.run('sw1', 'w1', iso(now + 7 * DAY), 3, 2, iso(now - 4 * DAY));
    if (dueKanji) {
      item.run('k1', 'KANJI', '日', null, 'NHẬT', 'mặt trời; ngày', 'N5', iso(now - 4 * DAY));
      srs.run('sk1', 'k1', iso(now - DAY), 3, 2, iso(now - 4 * DAY));
    }
  } finally {
    db.close();
  }
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

const shot = async (page: Page, name: string) => {
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
};

test.beforeEach(async () => {
  await seedE2eAccount();
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`a new kanji is met with its back open, its word from the library on it (${width}px)`, async ({
    page,
  }) => {
    seed({ dueKanji: false });
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/review', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-slot="kanji-glyph"]')).toHaveText('経');
    await expect(page.getByText('Chữ mới: nhớ âm Hán Việt và nghĩa')).toBeVisible();
    await expect(page.getByText('[KINH]')).toBeVisible();
    await expect(page.locator('[data-slot="kanji-word"]')).toContainText('経済');
    await shot(page, `on-nhanh-kanji-moi-${width}`);
    await page.getByRole('button', { name: 'Đã xem' }).click();
    await expect(page.getByText('Xong buổi ôn')).toBeVisible();
  });

  test(`a due kanji asks for its Hán Việt and meaning, then is graded (${width}px)`, async ({
    page,
  }) => {
    seed({ dueKanji: true });
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/review', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-slot="kanji-glyph"]')).toHaveText('日');
    await expect(page.getByText('Chữ này âm Hán Việt là gì, nghĩa là gì?')).toBeVisible();
    await expect(page.getByText('[NHẬT]')).toHaveCount(0);
    await shot(page, `on-nhanh-kanji-hoi-${width}`);
    await page.getByRole('button', { name: 'Xem đáp án' }).click();
    await expect(page.getByText('[NHẬT]')).toBeVisible();
    await expect(page.getByText('mặt trời; ngày')).toBeVisible();
    await shot(page, `on-nhanh-kanji-dap-an-${width}`);
    await page.getByRole('button', { name: /^Nhớ/ }).click();
    await expect(page.getByText('Xong buổi ôn')).toBeVisible();
    await expect(page.getByText('Kanji')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`Cài đặt sets how many new kanji a day (${width}px)`, async ({ page }) => {
    seed({ dueKanji: false });
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/settings?tab=practice', { waitUntil: 'networkidle' });
    const field = page.getByRole('textbox', { name: 'Kanji mới / ngày' });
    await field.scrollIntoViewIfNeeded();
    await expect(field).toHaveValue('1');
    await shot(page, `cai-dat-kanji-moi-${width}`);
  });
}
