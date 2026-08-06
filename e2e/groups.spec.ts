// Study groups, end to end in a real browser with a real session.
//
// The feature came back single-user on 2026-08-05 and had unit tests for lib/groups.ts but NO browser
// coverage — and two of its controls (BulkGroupButton, ItemGroups) shipped fully written and NEVER
// IMPORTED for two days. Nothing failed: typecheck is happy with an unused module, and the unit tests
// exercise the DB layer those components call. Only rendering the page shows a menu that is not there.
//
// What each step pins down, beyond "it does not crash":
//   1. the kind guard reaches the UI — a vocab-only group is not offered to a grammar selection
//   2. the item-detail chips read the same membership the table just wrote
//   3. "Gỡ khỏi nhóm" lists only groups the selection is in, and disappears when that set is empty
//      (which is what the per-row `groupIds` from listItems({ withGroupIds }) is for)
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

test('bulk add/remove to group, and the item-detail membership chips', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const item = db.prepare(
    `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
       captureReason, suspended, starred, createdAt, challengeObservations)
     VALUES (?, ?, ?, NULL, NULL, ?, 'N2', NULL, 'MCP', NULL, 0, 0, ?, 0)`,
  );
  item.run('g0', 'GRAMMAR', '〜ばかりに', 'chỉ vì', iso(now));
  item.run('g1', 'GRAMMAR', '〜ざるを得ない', 'buộc phải', iso(now - 1000));
  item.run('v0', 'VOCAB', '把握', 'nắm bắt', iso(now - 2000));
  db.prepare(
    `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
  ).run('grp1', 'Nhóm N2', 'grammar', iso(now), iso(now));
  db.prepare(
    `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
  ).run('grp2', 'Chỉ từ vựng', 'vocab', iso(now), iso(now));
  db.close();

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().split('\n')[0]));

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  // ---- 1. bulk ADD from the grammar table -------------------------------------------------
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await page.getByRole('button', { name: 'Thêm vào nhóm' }).click();
  // the vocab-only group must NOT be offered to a grammar selection
  await expect(page.getByRole('menuitem', { name: /Chỉ từ vựng/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: /Nhóm N2/ }).click();
  await expect(page.getByText(/Đã thêm 2 mục vào nhóm/)).toBeVisible({ timeout: 10_000 });

  // ---- 2. the detail page now shows the chip, and offers no second copy ---------------------
  await page.goto('/resources/g0', { waitUntil: 'networkidle' });
  await expect(page.getByRole('link', { name: 'Nhóm N2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm vào nhóm' })).toHaveCount(0);

  // ---- 3. remove it from the detail page ---------------------------------------------------
  await page.getByRole('button', { name: 'Gỡ khỏi nhóm Nhóm N2' }).click();
  await expect(page.getByText(/Đã gỡ khỏi nhóm/)).toBeVisible({ timeout: 10_000 });
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Thêm vào nhóm' })).toBeVisible();

  // ---- 4. bulk REMOVE only lists groups the selection is actually in ------------------------
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await page.getByRole('button', { name: 'Gỡ khỏi nhóm' }).click();
  await page.getByRole('menuitem', { name: /Nhóm N2/ }).click();
  await expect(page.getByText(/Đã gỡ 1 mục khỏi nhóm/)).toBeVisible({ timeout: 10_000 });

  // now nothing is in any group → the remove button disappears entirely
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  await expect(page.getByRole('button', { name: 'Gỡ khỏi nhóm' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thêm vào nhóm' })).toBeVisible();

  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

/**
 * The two group behaviours that a screenshot cannot show, both added 2026-08-05 by request.
 *
 * 1. ADD/EDIT IS A MODAL ON DESKTOP, A ROUTE ON A PHONE. Implemented as two triggers hidden at each
 *    other's breakpoint (components/groups/group-actions.tsx), which is exactly the kind of thing that
 *    silently regresses to "both" or "neither" — a `md:hidden` typo looks fine in one viewport.
 * 2. AUTO-READ THE JAPANESE, per direction. Asserted through /api/tts: that request IS the read (the
 *    VOICEVOX path is primary), and its `text=` says WHICH string was read. The rule under test:
 *      ja→vi  — read the term as the card appears
 *      vi→ja  — read NOTHING on the prompt (it is Vietnamese; reading the Japanese would be the answer),
 *               then the term (and ONLY the term, never the examples) once flipped.
 */
test('group actions: modal on desktop, route on a phone', async ({ page }) => {
  await seedE2eAccount();
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  // --- desktop: the control is a BUTTON, it opens a dialog, and the URL does NOT change ---
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/resources?tab=groups', { waitUntil: 'networkidle' });
  // The role is part of the contract, not an implementation detail: a dialog trigger must be a button
  // (nothing to navigate to), and the phone's must be a link (so middle-click / "copy link" / the back
  // button all work). Asserting the role is also what makes this test fail if both triggers ever show.
  await expect(page.getByRole('link', { name: 'Tạo nhóm' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tạo nhóm' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tạo nhóm mới' })).toBeVisible();
  expect(new URL(page.url()).pathname, 'desktop must NOT navigate').toBe('/resources');
  await page.keyboard.press('Escape');

  // --- phone: the same control is a LINK to the route, and no dialog appears ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/resources?tab=groups', { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Tạo nhóm' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Tạo nhóm' }).click();
  await page.waitForURL((u) => u.pathname === '/groups/new', { timeout: 15_000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // …and the route it lands on is the form, with the action breadcrumb.
  await expect(page.getByRole('link', { name: /Nhóm/ }).first()).toBeVisible();
  await expect(page.getByLabel('Tên nhóm')).toBeVisible();
});

test('flashcards read the Japanese per direction, and never the examples', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  // THREE members — one card cannot show the bug this test's second half guards (the repeat-slow latch
  // only bites on the SECOND card), and each one carries an example (`notes`) so "the examples are not
  // read" is a real claim on whichever card the deck lands on, not a vacuous one.
  const TERMS = ['把握', '曖昧', '矛盾'];
  const EXAMPLES = ['状況を把握する。', '曖昧な返事だった。', '話が矛盾している。'];
  const item = db.prepare(
    `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
       captureReason, suspended, starred, createdAt, challengeObservations)
     VALUES (?, 'VOCAB', ?, ?, ?, ?, 'N2', ?, 'MCP', NULL, 0, 0, ?, 0)`,
  );
  item.run('v9', TERMS[0], 'はあく', 'bả ác', 'nắm bắt, hiểu rõ', EXAMPLES[0], iso(now));
  item.run('v8', TERMS[1], 'あいまい', 'ái muội', 'mơ hồ', EXAMPLES[1], iso(now - 1000));
  item.run('v7', TERMS[2], 'むじゅん', 'mâu thuẫn', 'mâu thuẫn', EXAMPLES[2], iso(now - 2000));
  db.prepare(
    `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
     VALUES ('grpF', 'Nhóm flashcard', 'vocab', NULL, NULL, ?, ?)`,
  ).run(iso(now), iso(now));
  const member = db.prepare(
    `INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('grpF', ?, ?)`,
  );
  for (const id of ['v9', 'v8', 'v7']) member.run(id, iso(now));
  db.close();

  // Both the text AND the rate matter, so keep the whole query. `/api/tts` omits `rate` at the default
  // speed and sends `rate=0.6` for a slow (repeat) play — see SLOW_FACTOR in speak-button.tsx.
  const read: string[] = [];
  const slow: string[] = [];
  page.on('request', (r) => {
    if (!r.url().includes('/api/tts')) return;
    const q = new URL(r.url()).searchParams;
    const text = q.get('text');
    if (!text) return;
    read.push(text);
    const rate = q.get('rate');
    if (rate != null && Number(rate) < 1) slow.push(`${text} @ rate=${rate}`);
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/groups/grpF', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Flashcard' }).click();
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  await page.getByRole('switch', { name: /Tự đọc tiếng Nhật/ }).click();
  await page.keyboard.press('Escape');

  // ja→vi (the default): the term is the PROMPT, so it reads straight away.
  await expect.poll(() => read.length, { timeout: 10_000 }).toBe(1);
  expect(TERMS).toContain(read[0]);

  // EVERY card is a first listen. The "slow on repeat" alternation is per BUTTON, and one button reads
  // every card in the deck, so before 2026-08-05 the auto-read walked it by itself: card 1 normal, card 2
  // at rate=0.6, card 3 normal… ("cứ cách một thẻ là bị mắc cơ chế này").
  // The deck advances with "Thẻ sau" — the arrow under the card. It used to advance with "Đã thuộc";
  // that button (and its "Đang học" twin) went out on 2026-08-06 when the deck became a swipe pile.
  for (let card = 2; card <= 3; card++) {
    await page.getByRole('button', { name: 'Thẻ sau' }).click();
    await expect.poll(() => read.length, { timeout: 10_000 }).toBe(card);
  }
  // Distinct terms = each card read ITS OWN text (not a replay of card 1, which would also pass a count).
  expect(new Set(read).size, `each card reads its own term, got: ${read.join(', ')}`).toBe(3);
  expect(slow, `an auto-read came out SLOW — the repeat-press latch leaked into it:\n${slow.join('\n')}`).toEqual([]);

  // vi→ja: the prompt is Vietnamese — nothing may be read until the card is flipped.
  read.length = 0;
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  await page.getByRole('button', { name: 'Việt → Nhật' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  expect(read, 'reading the Japanese on a vi→ja prompt gives the answer away').toEqual([]);

  await page.getByRole('button', { name: /Lật xem mặt sau/ }).click();
  await expect.poll(() => read.length, { timeout: 10_000 }).toBe(1);
  // The term, NOT the example sentence stored in notes (every member has one, so this bites whichever
  // card the deck is on).
  expect(TERMS).toContain(read[0]);
  for (const ex of EXAMPLES) expect(read).not.toContain(ex);
  expect(slow, `a vi→ja auto-read came out SLOW:\n${slow.join('\n')}`).toEqual([]);
});
