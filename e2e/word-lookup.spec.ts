import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// thien, 7.4b: every Japanese sentence looks its words up. The words with a meaning get a dotted
// underline; the mouse resting on one opens its card, the same card in a list and in a dialog.

const SENTENCE = '駅で友達に会いました。';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

/** The centre of a character of the sentence inside `scope`, as drawn. */
async function charAt(page: Page, scope: string, ch: string) {
  const box = await page.evaluate(
    ([scopeSel, c]) => {
      const root = [...document.querySelectorAll(`${scopeSel} [data-lookup]`)].find(
        (el) => el.getClientRects().length > 0,
      )!;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const i = (n as Text).data.indexOf(c);
        if (i === -1 || n.parentElement?.closest('rt')) continue;
        const range = document.createRange();
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        const r = range.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return null;
    },
    [scope, ch] as const,
  );
  expect(box).not.toBeNull();
  return box!;
}

test('the mouse resting on a word opens its card, in the list and in the dialog', async ({
  page,
}) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  for (const t of ['ReviewLog', 'Sentence', 'SrsState', 'Item']) db.exec(`DELETE FROM "${t}"`);
  db.prepare(
    `INSERT INTO Sentence (userId, id, direction, exerciseType, sourceText, sourceRuby, suggested,
       suggestedRuby, userAnswer, feedback, score, context, createdAt, starred, status)
     VALUES (${E2E_OWNER}, 's-lookup', 'JA_VI', 'TRANSLATE', ?, NULL, 'Tôi đã gặp bạn ở ga.',
       NULL, 'Tôi gặp bạn ở ga.', NULL, 90, NULL, ?, 0, 'GRADED')`,
  ).run(SENTENCE, new Date().toISOString());
  db.close();

  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/history');
  await expect(page.locator('main [data-lookup]:visible').first()).toBeVisible();
  // The words with a meaning are underlined once the server has answered.
  await expect
    .poll(() => page.evaluate(() => CSS.highlights.get('word-lookup')?.size ?? 0))
    .toBeGreaterThan(0);

  const card = page.locator('[data-slot="word-card"]');
  const friend = await charAt(page, 'main', '友');
  await page.mouse.move(friend.x, friend.y);
  await expect(card).toBeVisible();
  await expect(card).toContainText('友達');
  await expect(card.getByRole('button', { name: 'Thêm vào kho' })).toBeVisible();

  // Off the word, the card goes; on the verb, its card names the dictionary form.
  await page.mouse.move(1300, 850);
  await expect(card).toBeHidden();
  const meet = await charAt(page, 'main', '会');
  await page.mouse.move(meet.x, meet.y);
  await expect(card).toContainText('会う');
  await expect(card).toContainText('Trong câu');
  await page.mouse.move(1300, 850);
  await expect(card).toBeHidden();

  // The turn's detail panel looks its sentence up as well.
  await page.locator('[data-history-row]').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const station = await charAt(page, '[role="dialog"]', '駅');
  await page.mouse.move(station.x, station.y);
  await expect(card).toBeVisible();
  await expect(card).toContainText('駅');
});

test('Ôn nhanh looks up its sentence but never the word under review', async ({ page }) => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);
  const example = JSON.stringify({
    structure: [],
    usage: 'u',
    example: {
      ja: '友達と約束をしました。',
      vi: 'Tôi đã hẹn với bạn.',
      jaRuby: '友達[ともだち]と約束[やくそく]をしました。',
    },
    pitfalls: [],
  });
  db.prepare(
    `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
       captureReason, suspended, starred, createdAt, enrichment)
     VALUES (${E2E_OWNER}, 'w1', 'VOCAB', '約束', 'やくそく', NULL, 'lời hứa', 'N5', NULL, 'MCP', NULL,
       0, 0, ?, ?)`,
  ).run(new Date(now - 4 * 86_400_000).toISOString(), example);
  db.prepare(
    `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays,
       learningSteps, reps, lapses, state, lastReview)
     VALUES (${E2E_OWNER}, 'sw1', 'w1', ?, 4, 5, 3, 0, 2, 0, 2, ?)`,
  ).run(new Date(now - 86_400_000).toISOString(), new Date(now - 4 * 86_400_000).toISOString());
  db.close();

  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/review');
  const marked = () =>
    page.evaluate(() =>
      [...(CSS.highlights.get('word-lookup') ?? [])].map((r) => (r as Range).toString()).join('|'),
    );
  await expect.poll(marked).toContain('友');
  expect(await marked()).not.toContain('約');

  const friend = await charAt(page, 'main', '友');
  await page.mouse.move(friend.x, friend.y);
  const card = page.locator('[data-slot="word-card"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('友達');
});
