import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

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
      `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt, enrichment)
       VALUES (${E2E_OWNER}, ?, 'VOCAB', ?, ?, NULL, ?, 'N2', NULL, 'MCP', NULL, 0, 0, ?, ?)`,
    );
    const srs = db.prepare(
      `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays, learningSteps,
         reps, lapses, state, lastReview)
       VALUES (${E2E_OWNER}, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, NULL)`,
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
      `INSERT INTO "Group" (userId, id, name, kind, color, note, createdAt, updatedAt)
       VALUES (${E2E_OWNER}, 'grpC', 'Nhóm thẻ', 'vocab', NULL, NULL, ?, ?)`,
    ).run(iso(now), iso(now));
    const member = db.prepare(
      `INSERT INTO GroupMember (userId, groupId, itemId, addedAt) VALUES (${E2E_OWNER}, 'grpC', ?, ?)`,
    );
    for (const [id] of rows) member.run(id, iso(now));
  } finally {
    db.close();
  }
}

// Long grammar names in the group, and 25 more items outside it for the add page.
function seedLong() {
  seed();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  try {
    const item = db.prepare(
      `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt)
       VALUES (${E2E_OWNER}, ?, 'VOCAB', ?, NULL, NULL, ?, 'N1', NULL, 'MCP', NULL, 0, 0, ?)`,
    );
    item.run(
      'long',
      '〜(よ)うが〜まいが / 〜(よ)うと〜まいと',
      'Dù có... hay không thì cũng...',
      iso(now),
    );
    db.prepare(
      `INSERT INTO GroupMember (userId, groupId, itemId, addedAt) VALUES (${E2E_OWNER}, 'grpC', 'long', ?)`,
    ).run(iso(now));
    for (let i = 0; i < 25; i++) item.run(`o${i}`, `語彙${i}`, `nghĩa ${i}`, iso(now - i));
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

test('a group is browsed as flashcards that remember their place, and browsing grades nothing', async ({
  page,
}) => {
  seed();
  await login(page);
  await openCards(page);

  // The front is the word alone, no question; the card turns over to its meaning and example.
  const card = page.getByRole('button', { name: /Bấm để lật/ });
  await expect(card).toHaveAccessibleName('把握. Bấm để lật');
  await expect(page.getByText('Từ gạch chân nghĩa là gì?')).toHaveCount(0);
  await expect(page.getByText('nắm bắt', { exact: true })).not.toBeVisible();
  await card.click();
  await expect(page.getByText('nắm bắt', { exact: true })).toBeVisible();
  await expect(page.getByText('Nắm bắt tình hình.')).toBeVisible();
  await page.getByRole('button', { name: 'Lật thẻ' }).click();
  await expect(page.getByText('nắm bắt', { exact: true })).not.toBeVisible();

  await page.getByRole('button', { name: 'Thẻ sau' }).click();
  await expect(page.getByLabel('Thẻ 2 / 3')).toBeVisible();
  await page.getByRole('button', { name: 'Thẻ trước' }).click();
  await expect(page.getByLabel('Thẻ 1 / 3')).toBeVisible();

  // The keyboard walks the same way: arrows step, Space turns the card.
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Thẻ 2 / 3')).toBeVisible();
  await page.keyboard.press(' ');
  await expect(page.getByText('mơ hồ', { exact: true })).toBeVisible();

  // The place survives a reload.
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByLabel('Thẻ 2 / 3')).toBeVisible();

  // Shuffling starts over in another order; the order also survives a reload.
  const shuffle = page.getByRole('button', { name: 'Đảo thứ tự' });
  await shuffle.click();
  await expect(shuffle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Thẻ 1 / 3')).toBeVisible();
  const first = await page.getByRole('button', { name: /Bấm để lật/ }).getAttribute('aria-label');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: /Bấm để lật/ })).toHaveAccessibleName(first!);
  await shuffle.click();
  await expect(shuffle).toHaveAttribute('aria-pressed', 'false');
  await expect(card).toHaveAccessibleName('把握. Bấm để lật');

  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Thẻ sau' }).click();
  await expect(page.getByText('Đã xem hết 3 thẻ')).toBeVisible();
  await page.getByRole('button', { name: 'Xem lại từ đầu' }).click();
  await expect(page.getByLabel('Thẻ 1 / 3')).toBeVisible();
  expect(reviewLogCount(), 'browsing a group never touches the schedule').toBe(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('group items fit a phone, and the add page keeps Thêm in reach', async ({ page }) => {
    seedLong();
    await login(page);
    await page.goto('/groups/grpC', { waitUntil: 'networkidle' });
    const card = page
      .locator('[data-slot="data-table-cards"] > li')
      .filter({ hasText: '〜(よ)うが' });
    expect(
      await card.evaluate((el) => el.scrollWidth <= el.clientWidth),
      'a long name wraps inside its card, it does not spill sideways',
    ).toBe(true);

    // The list template on a phone: cards that load more as they scroll, not pages.
    await page.goto('/groups/grpC/add', { waitUntil: 'networkidle' });
    const picks = page.getByRole('checkbox', { name: 'Chọn mục này' });
    await expect(picks).toHaveCount(20);
    const add = page.getByRole('button', { name: 'Thêm', exact: true });
    const box = (await add.boundingBox())!;
    expect(box.y + box.height, 'the add button is in reach without scrolling').toBeLessThanOrEqual(
      844,
    );
    await picks.first().click();
    // DataTable renders the footer under the cards and under the table; CSS shows one.
    await expect(page.getByText('Đã chọn 1 mục').filter({ visible: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => picks.count()).toBeGreaterThan(20);
  });

  test('group cards at 390px: no sideways scroll, the controls above the fold', async ({
    page,
  }) => {
    seed();
    await login(page);
    await openCards(page);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const button = document.querySelector('button[aria-label="Thẻ sau"]')!;
      return {
        overflowX: de.scrollWidth - de.clientWidth,
        bottom: Math.round(button.getBoundingClientRect().bottom),
        viewportH: de.clientHeight,
      };
    });
    expect(m.overflowX, 'no horizontal scroll').toBeLessThanOrEqual(0);
    expect(m.bottom, 'the next button is reachable without scrolling').toBeLessThanOrEqual(
      m.viewportH,
    );
  });
});
