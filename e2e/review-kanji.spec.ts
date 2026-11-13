import path from 'node:path';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { pathPoints, STROKE_BOX } from '@/lib/japanese/strokes';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// KJ3 (docs/plans/2026-11-08-kanji.md › Học một chữ): Ôn nhanh brings in new kanji itself, the kanji
// of the words being learned first, and tests a kanji by its glyph alone: the back gives the Hán
// Việt, the meaning, the readings and the learner's words that use it. KJ4: every other review of a
// met kanji asks for it to be written on the pad, which grades each stroke and suggests the rating.

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

function seed({ dueKanji, reps = 2 }: { dueKanji: boolean; reps?: number }) {
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
      // An even count of reviews asks for the meaning, an odd one for the writing.
      srs.run('sk1', 'k1', iso(now - DAY), reps, 2, iso(now - 4 * DAY));
    }
  } finally {
    db.close();
  }
}

// 日 as KanjiVG writes it: four strokes.
const STROKES: string[] = JSON.parse(
  readFileSync(path.join(process.cwd(), 'data/kanji/strokes.json'), 'utf8'),
)['日'];

/** Draws stroke `n` of 日 on the pad, as a hand would: pressed, dragged through its points, let go. */
async function drawStroke(page: Page, n: number) {
  const box = (await page.locator('[data-slot="kanji-pad"]').boundingBox())!;
  const at = (p: { x: number; y: number }) => ({
    x: box.x + (p.x / STROKE_BOX) * box.width,
    y: box.y + (p.y / STROKE_BOX) * box.height,
  });
  const [first, ...rest] = pathPoints(STROKES[n]).map(at);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.mouse.up();
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
  // A glyph being drawn stroke by stroke is shot once it is whole.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => (a as CSSAnimation).animationName === 'kanji-stroke')
        .map((a) => a.finished),
    ),
  );
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
    // Met with its back open: the glyph is drawn stroke by stroke, in its order (KJ4).
    await expect(page.getByRole('img', { name: '経' })).toBeVisible();
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
    // A screen shorter than the back of the card: the grades stay on screen, stuck to its foot.
    await page.setViewportSize({ width, height: 600 });
    await expect(async () => {
      const bar = (await page.getByRole('group', { name: 'Chấm thẻ' }).boundingBox())!;
      expect(bar.y + bar.height).toBeLessThanOrEqual(600);
    }).toPass();
    await page.setViewportSize({ width, height });
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
  test(`a kanji written stroke by stroke is graded by the pad (${width}px)`, async ({ page }) => {
    seed({ dueKanji: true, reps: 1 });
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/review', { waitUntil: 'networkidle' });
    await expect(page.getByText('Viết chữ này theo đúng thứ tự nét')).toBeVisible();
    // The front asks from the Hán Việt and meaning; the glyph itself is the answer.
    await expect(page.getByText('[NHẬT]')).toBeVisible();
    await expect(page.locator('[data-slot="kanji-glyph"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Xem đáp án' })).toHaveCount(0);
    await shot(page, `on-nhanh-kanji-viet-${width}`);

    // The second stroke first: wrong order, drawn again.
    await drawStroke(page, 1);
    await expect(page.getByText('Nét 1 chưa đúng, viết lại')).toBeVisible();
    await shot(page, `on-nhanh-kanji-viet-sai-${width}`);
    for (let n = 0; n < STROKES.length - 1; n++) {
      await drawStroke(page, n);
      await expect(page.locator('[data-slot="kanji-pad"]')).toHaveAttribute(
        'data-done',
        String(n + 1),
      );
    }
    // The last stroke ends the writing: the back opens, the glyph drawn again in its order.
    await drawStroke(page, STROKES.length - 1);
    await expect(page.getByRole('img', { name: '日' })).toBeVisible();

    // One mistake, no hint: Khó, which Enter gives.
    await expect(page.locator('[data-slot="kanji-suggested"]')).toContainText('Máy chấm: Khó');
    await expect(page.getByText('mặt trời; ngày')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Khó/ })).toHaveAttribute(
      'aria-keyshortcuts',
      '2 Enter',
    );
    await shot(page, `on-nhanh-kanji-viet-cham-${width}`);
    await page.keyboard.press('Enter');
    await expect(page.getByText('Xong buổi ôn')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });

  test(`"Không nhớ" on the pad suggests Quên (${width}px)`, async ({ page }) => {
    seed({ dueKanji: true, reps: 1 });
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/review', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Không nhớ' }).click();
    await expect(page.locator('[data-slot="kanji-suggested"]')).toContainText('Máy chấm: Quên');
    await page.getByRole('button', { name: /^Quên/ }).click();
    // A missed card comes back, ungraded, at the end: written again.
    await expect(page.locator('[data-slot="kanji-pad"]')).toBeVisible();
  });

  test(`Cài đặt sets how many new kanji a day (${width}px)`, async ({ page }) => {
    seed({ dueKanji: false });
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto('/settings?tab=practice', { waitUntil: 'networkidle' });
    const field = page.getByRole('textbox', { name: 'Kanji mới / ngày' });
    await field.scrollIntoViewIfNeeded();
    await expect(field).toHaveValue('1');
    const handwriting = page.getByRole('switch', { name: 'Viết kanji khi ôn' });
    await expect(handwriting).toBeChecked();
    await shot(page, `cai-dat-kanji-moi-${width}`);
    await handwriting.click();
    await expect(handwriting).not.toBeChecked();
  });
}
