import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');

const card = (ja: string, vi: string, jaRuby: string) =>
  JSON.stringify({ structure: [], usage: 'u', example: { ja, vi, jaRuby }, pitfalls: [] });

function seed() {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    const item = db.prepare(
      `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt, challengeObservations, enrichment)
       VALUES (?, 'VOCAB', ?, ?, NULL, ?, 'N2', NULL, 'MCP', NULL, 0, 0, ?, 0, ?)`,
    );
    const srs = db.prepare(
      `INSERT INTO SrsState (id, itemId, due, stability, difficulty, scheduledDays, learningSteps,
         reps, lapses, state, lastReview)
       VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, NULL)`,
    );
    const rows: [string, string, string, string, string | null][] = [
      [
        'g1',
        '把握',
        'はあく',
        'nắm bắt',
        card('状況を把握する。', 'Nắm bắt tình hình.', '状況[じょうきょう]を把握[はあく]する。'),
      ],
      ['g2', '曖昧', 'あいまい', 'mơ hồ', null],
      ['g3', '矛盾', 'むじゅん', 'mâu thuẫn', null],
    ];
    rows.forEach(([id, expression, reading, meaning, enrichment], n) => {
      item.run(id, expression, reading, meaning, iso(now - n * 1000), enrichment);
      srs.run(`s${id}`, id, iso(now));
    });
    db.prepare(
      `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
       VALUES ('grpC', 'Nhóm thẻ', 'vocab', NULL, NULL, ?, ?)`,
    ).run(iso(now), iso(now));
    const member = db.prepare(
      `INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('grpC', ?, ?)`,
    );
    for (const [id] of rows) member.run(id, iso(now));
  } finally {
    db.close();
  }
}

function reviewLogCount(): number {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE), { readonly: true });
  try {
    return (db.prepare('SELECT COUNT(*) AS n FROM ReviewLog').get() as { n: number }).n;
  } finally {
    db.close();
  }
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

async function openCards(page: Page) {
  await page.goto('/groups/grpC', { waitUntil: 'networkidle' });
  const tab = page.getByRole('tab', { name: 'Flashcard' });
  if (await tab.isVisible()) await tab.click();
  else {
    await page.getByRole('combobox', { name: 'Chọn khung xem' }).click();
    await page.getByRole('option', { name: 'Flashcard' }).click();
  }
  await expect(page.getByLabel('Thẻ 1 / 3')).toBeVisible();
}

test.beforeAll(seedE2eAccount);

test('a group is browsed on the quick-review card, and browsing grades nothing', async ({
  page,
}) => {
  seed();
  await login(page);
  await openCards(page);

  // The word stands in its example sentence, underlined; the answer opens below on request.
  await expect(page.getByText('Từ gạch chân nghĩa là gì?')).toBeVisible();
  await expect(page.getByText('nắm bắt', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem đáp án' }).click();
  await expect(page.getByText('nắm bắt', { exact: true })).toBeVisible();
  await expect(page.getByText('Nắm bắt tình hình.')).toBeVisible();

  await page.getByRole('button', { name: 'Tiếp' }).click();
  await expect(page.getByLabel('Thẻ 2 / 3')).toBeVisible();
  await page.getByRole('button', { name: 'Trước' }).click();
  await expect(page.getByLabel('Thẻ 1 / 3')).toBeVisible();

  // The keyboard walks the same way: Enter reveals then moves on, arrows step.
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Thẻ 2 / 3')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('mơ hồ', { exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Thẻ 3 / 3')).toBeVisible();
  await page.getByRole('button', { name: 'Xem đáp án' }).click();
  await page.getByRole('button', { name: 'Tiếp' }).click();

  await expect(page.getByText('Đã xem hết 3 thẻ')).toBeVisible();
  await page.getByRole('button', { name: 'Xem lại từ đầu' }).click();
  await expect(page.getByLabel('Thẻ 1 / 3')).toBeVisible();
  expect(reviewLogCount(), 'browsing a group never touches the schedule').toBe(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('group cards at 390px: no sideways scroll, the buttons above the fold', async ({ page }) => {
    seed();
    await login(page);
    await openCards(page);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const button = [...document.querySelectorAll('button')].find(
        (b) => b.textContent === 'Xem đáp án',
      )!;
      return {
        overflowX: de.scrollWidth - de.clientWidth,
        bottom: Math.round(button.getBoundingClientRect().bottom),
        viewportH: de.clientHeight,
      };
    });
    expect(m.overflowX, 'no horizontal scroll').toBeLessThanOrEqual(0);
    expect(m.bottom, 'the answer button is reachable without scrolling').toBeLessThanOrEqual(
      m.viewportH,
    );
  });
});
