// The card decks, driven by a real pointer in a real browser.
//
// Both decks were rebuilt on 2026-08-06 into a Quizlet-style pile: no grading buttons under the card,
// no instruction line, and SWIPE as the way through. Two of those three are claims a unit test cannot
// make — a drag is a sequence of real pointer events with velocity, and "the buttons are gone" is only
// true of the rendered page — so they are pinned here.
//
// What each half proves:
//   1. group deck  — the removed controls are actually absent, and a horizontal DRAG moves the deck
//      both ways. Arrows and drag are asserted separately: they are different code paths (a click
//      handler vs. onDragEnd's distance+velocity threshold) and only one of them is the phone.
//   2. history deck — /history can be read as cards, the deck is dealt from the FILTERED rows, and a
//      card's back carries the reference answer the đề was drilling.
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

/**
 * A real horizontal swipe across the card: press, MOVE IN STEPS, release. The steps matter — a single
 * mouse.move jumps the pointer, and a drag recogniser that reads velocity sees one impossible frame
 * rather than a gesture. `dx < 0` swipes left (forward), `dx > 0` swipes right (back).
 */
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
  // Let the enter/exit slide (280ms) finish before the next assertion reads the deck.
  await page.waitForTimeout(500);
}

test('the group deck is a swipe pile: no grading buttons, and a drag moves it both ways', async ({
  page,
}) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const item = db.prepare(
    `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
       captureReason, suspended, starred, createdAt, challengeObservations)
     VALUES (?, 'VOCAB', ?, ?, NULL, ?, 'N2', NULL, 'MCP', NULL, 0, 0, ?, 0)`,
  );
  item.run('s1', '把握', 'はあく', 'nắm bắt', iso(now));
  item.run('s2', '曖昧', 'あいまい', 'mơ hồ', iso(now - 1000));
  item.run('s3', '矛盾', 'むじゅん', 'mâu thuẫn', iso(now - 2000));
  db.prepare(
    `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
     VALUES ('grpS', 'Nhóm vuốt', 'vocab', NULL, NULL, ?, ?)`,
  ).run(iso(now), iso(now));
  const member = db.prepare(
    `INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('grpS', ?, ?)`,
  );
  for (const id of ['s1', 's2', 's3']) member.run(id, iso(now));
  db.close();

  await login(page);
  await page.goto('/groups/grpS', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Flashcard' }).click();
  await expect(page.getByText('Thẻ 1 / 3')).toBeVisible();

  // --- the removals the user asked for, asserted as ABSENCE ---
  await expect(page.getByRole('button', { name: /Đã thuộc/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Đang học/ })).toHaveCount(0);
  // The instruction line under the card. `getByText` with a substring so a reworded tip still fails.
  await expect(page.getByText(/để lật/)).toHaveCount(0);

  // --- swipe LEFT = forward. The counter is the deck's own report of where it is. ---
  await swipe(page, -260);
  await expect(page.getByText('Thẻ 2 / 3')).toBeVisible();
  await swipe(page, -260);
  await expect(page.getByText('Thẻ 3 / 3')).toBeVisible();

  // --- swipe RIGHT = back. "lướt qua lướt lại" is both directions, so both are pinned. ---
  await swipe(page, 260);
  await expect(page.getByText('Thẻ 2 / 3')).toBeVisible();

  // --- a SHORT drag is not a swipe: it springs back and the deck stays put. Without this, a deck
  //     that advanced on any pointer movement at all would pass everything above. ---
  await swipe(page, -20);
  await expect(page.getByText('Thẻ 2 / 3')).toBeVisible();

  // --- the arrows are the same two moves for a mouse ---
  await page.getByRole('button', { name: 'Thẻ sau' }).click();
  await expect(page.getByText('Thẻ 3 / 3')).toBeVisible();
  await page.getByRole('button', { name: 'Thẻ trước' }).click();
  await expect(page.getByText('Thẻ 2 / 3')).toBeVisible();

  // --- past the last card is the end of the pile, not a crash ---
  await page.getByRole('button', { name: 'Thẻ sau' }).click();
  await page.getByRole('button', { name: 'Thẻ sau' }).click();
  await expect(page.getByText('Đã lướt hết 3 thẻ')).toBeVisible();
  await page.getByRole('button', { name: 'Học lại từ đầu' }).click();
  await expect(page.getByText('Thẻ 1 / 3')).toBeVisible();
});

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
  // A PENDING row has no answer side, so it must never become a card — the deck would show a blank back.
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

  // Two of the three rows are studiable; the PENDING one is not.
  await expect(page.getByText('Lượt 1 / 2')).toBeVisible();

  // The front is the đề. Flipping shows the reference answer the đề was drilling.
  await expect(page.getByText('Tôi đã nắm được tình hình.')).toBeVisible();
  await page.getByRole('button', { name: /^Lật/ }).click();
  await expect(page.getByText('状況を把握しました。')).toBeVisible();
  await expect(page.getByText('Đúng ý, nên dùng thể lịch sự.')).toBeVisible();

  // Swiping deals the next one — and a new card always lands FACE DOWN, never on the answer. Asserted
  // through the flip control's own name rather than the answer's visibility: a CSS 3D flip keeps both
  // faces in the DOM (backface-visibility hides one, it is not unmounted), so "the answer is not on
  // screen" and "the answer is not in the tree" are different claims and only the first one is true.
  await swipe(page, -260);
  await expect(page.getByText('Lượt 2 / 2')).toBeVisible();
  await expect(page.getByText('曖昧な返事だった。')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lật xem mặt sau' })).toBeVisible();

  // The toolbar above keeps working WHILE the deck is open — that is the reason the mode toggle lives
  // in the toolbar instead of the page header. Narrowing the search to one row leaves a one-card deck,
  // and the deck must re-deal rather than keep pointing at a row that is no longer in the list.
  await page.getByPlaceholder('Tìm trong đề / bài dịch…').fill('曖昧');
  await expect(page.getByText('Lượt 1 / 1')).toBeVisible();

  // …and the toggle goes back to the list.
  await page.getByRole('button', { name: 'Danh sách' }).click();
  await expect(page.getByRole('button', { name: 'Thẻ sau' })).toHaveCount(0);
});

test('both decks fit a phone: nothing off-screen, and the arrows are reachable', async ({ page }) => {
  // The deck sizes itself off the viewport (`min-h-[calc(100svh-…)]`), which is exactly the kind of
  // number that is right on one screen and wrong on another — the nav row sat 15px below the fold on
  // /history at 1280x720 before the deck got a shorter allowance there. So it is measured, on the
  // narrow phone this was asked for, on BOTH decks (their chrome above the card differs).
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  db.prepare(
    `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
       captureReason, suspended, starred, createdAt, challengeObservations)
     VALUES ('p1', 'GRAMMAR', '〜ざるを得ない', NULL, NULL, 'không thể không, buộc phải', 'N2',
       NULL, 'MCP', NULL, 0, 0, ?, 0)`,
  ).run(iso(now));
  db.prepare(
    `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
     VALUES ('grpP', 'Nhóm điện thoại', 'grammar', NULL, NULL, ?, ?)`,
  ).run(iso(now), iso(now));
  db.prepare(`INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('grpP', 'p1', ?)`).run(
    iso(now),
  );
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
      'nhóm',
      async () => {
        await page.goto('/groups/grpP', { waitUntil: 'networkidle' });
        // Below md the tab bar is a Radix select, not a native one — click the trigger, pick the option.
        await page.getByRole('combobox', { name: 'Chọn khung xem' }).click();
        await page.getByRole('option', { name: 'Flashcard' }).click();
      },
    ],
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
        // The page may scroll a little; what matters is that the arrows are reachable WITHOUT it.
        viewportH: de.clientHeight,
      };
    });
    expect(m.overflowX, `${name}: the deck widened the page by ${m.overflowX}px at 390px`).toBeLessThanOrEqual(1);
    expect(
      m.arrowBottom,
      `${name}: the nav arrows end at ${m.arrowBottom}px, past the ${m.viewportH}px fold`,
    ).toBeLessThanOrEqual(m.viewportH);
  }
});
