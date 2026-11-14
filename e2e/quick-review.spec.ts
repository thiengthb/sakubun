import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');

const card = (ja: string, vi: string, jaRuby: string) =>
  JSON.stringify({ structure: [], usage: 'u', example: { ja, vi, jaRuby }, pitfalls: [] });

// One seen word that can be clozed, one new word met on an intro card, and two seen words with no
// sentence (not in OpenJLPT either), tested as bare flip cards.
function seed() {
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
    // This session is about grammar and vocab cards; e2e/review-kanji.spec.ts covers kanji (KJ3).
    db.prepare(
      `INSERT INTO Settings (userId, data, updatedAt) VALUES (${E2E_OWNER}, '{"dailyNewKanji":0}', ?)`,
    ).run(new Date().toISOString());
    const item = db.prepare(
      `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt, enrichment)
       VALUES (${E2E_OWNER}, ?, 'VOCAB', ?, ?, NULL, ?, 'N5', NULL, 'MCP', NULL, 0, 0, ?, ?)`,
    );
    const srs = db.prepare(
      `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays, learningSteps,
         reps, lapses, state, lastReview)
       VALUES (${E2E_OWNER}, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
    );
    item.run(
      'q1',
      '約束',
      'やくそく',
      'lời hứa',
      iso(now - 4 * DAY),
      card(
        '友達と約束をしました。',
        'Tôi đã hẹn với bạn.',
        '友達[ともだち]と約束[やくそく]をしました。',
      ),
    );
    srs.run('sq1', 'q1', iso(now - DAY), 4, 5, 3, 3, 2, iso(now - 4 * DAY));
    item.run(
      'q2',
      '準備',
      null,
      'chuẩn bị',
      iso(now - 3000),
      card(
        '旅行の準備をします。',
        'Tôi chuẩn bị cho chuyến đi.',
        '旅行[りょこう]の準備[じゅんび]をします。',
      ),
    );
    srs.run('sq2', 'q2', iso(now), 0, 0, 0, 0, 0, null);
    const bare: [string, string, string][] = [
      ['q3', '書き直す', 'viết lại'],
      ['q4', '言い張る', 'khăng khăng'],
    ];
    bare.forEach(([id, expression, meaning], n) => {
      item.run(id, expression, null, meaning, iso(now - (2 - n) * 1000), null);
      srs.run(`s${id}`, id, iso(now - DAY + n * 1000), 4, 5, 3, 3, 2, iso(now - 4 * DAY));
    });
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

// Every rating recorded this session, sorted.
function ratings(): number[] {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE), { readonly: true });
  try {
    const rows = db.prepare(`SELECT rating FROM ReviewLog ORDER BY rating`).all() as {
      rating: number;
    }[];
    return rows.map((r) => r.rating);
  } finally {
    db.close();
  }
}

// Server actions post to the page itself, marked by a Next-Action header.
const isAction = (method: string, headers: Record<string, string>) =>
  method === 'POST' && 'next-action' in headers;

function clozeRating(): number | undefined {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE), { readonly: true });
  try {
    const row = db.prepare(`SELECT rating FROM ReviewLog WHERE itemId = 'q1'`).get() as
      { rating: number } | undefined;
    return row?.rating;
  } finally {
    db.close();
  }
}

// By mouse every card is answered right. By keyboard the cloze gets a wrong pick that is lost on
// the network and sent again on its own (U2e), and the two flips are graded with 1 (Quên) and 4 (Dễ). The intro card
// asks nothing: "Đã xem" (or Enter) records Nhớ.
async function runSession(page: Page, { keyboard = false } = {}) {
  await login(page);
  await page.goto('/review');
  if (keyboard) {
    // Keys pressed before React hydrates the page are lost; wait until it owns the DOM.
    await page.waitForFunction(() => {
      const el = document.querySelector('[aria-label^="Thẻ "]');
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber'));
    });
  }
  let dropNext = false;
  await page.route('**/review', (route) => {
    const req = route.request();
    if (!dropNext || !isAction(req.method(), req.headers())) return route.continue();
    dropNext = false;
    return route.abort('internetdisconnected');
  });

  let sawCloze = false;
  let sawIntro = false;
  let sawBare = 0;
  const flipKeys = ['1', '4'];
  // Layout C: from 1280px the side panel shows the round's counts; narrower screens have none.
  const panel = page.getByRole('complementary', { name: 'Buổi ôn này' });
  const count = (label: string) => panel.locator(`dt:text-is("${label}") + dd`);
  const laptop = (page.viewportSize()?.width ?? 0) >= 1280;
  for (let n = 0; n < 4; n++) {
    await expect(page.getByLabel(`Thẻ ${n + 1} / 4`)).toBeVisible();
    if (laptop) await expect(count('Còn')).toHaveText(String(4 - n));
    else await expect(panel).toBeHidden();
    const choices = page.getByRole('group', { name: 'Chọn đáp án' });
    const reveal = page.getByRole('button', { name: 'Xem đáp án' });
    const seen = page.getByRole('button', { name: 'Đã xem' });
    await expect(choices.or(reveal).or(seen)).toBeVisible();
    if (await choices.isVisible()) {
      sawCloze = true;
      await expect(choices.getByRole('button')).toHaveCount(4);
      await expect(page.getByLabel('chỗ trống')).toBeVisible();
      await expect(page.locator('main p[lang="ja"]').first()).not.toContainText('約束');
      // U2b: the translation would give the answer away, so it waits for the pick.
      const translation = page.locator('main p[lang="vi"]');
      await expect(translation).toHaveCount(0);
      // On a phone the four answers sit at the foot of the screen, under the thumb; on a laptop
      // they follow the question.
      const viewport = page.viewportSize()!;
      const group = (await choices.boundingBox())!;
      if (viewport.width < 640) expect(group.y).toBeGreaterThan(viewport.height / 2);
      else {
        const question = (await page.locator('main p[lang="ja"]').first().boundingBox())!;
        expect(group.y - (question.y + question.height)).toBeLessThan(120);
      }
      const next = page.getByRole('button', { name: 'Tiếp' });
      if (keyboard) {
        const labels = await choices.getByRole('button').allTextContents();
        const wrong = String(labels.findIndex((t) => !t.includes('約束')) + 1);
        dropNext = true;
        await page.keyboard.press(wrong);
        // U2e: the answer shows at once; the lost grade waits on the device, says so, and goes
        // again on its own. The choices stay shut: a second pick would grade with the answer known.
        const unsaved = page.getByRole('status').filter({ hasText: 'Chưa lưu 1 thẻ' });
        await expect(unsaved).toBeVisible();
        await expect(choices.getByRole('button').first()).toBeDisabled();
        await expect(next).toBeEnabled();
        expect(reviewLogCount()).toBe(0);
        await expect(unsaved).toHaveCount(0);
        expect(clozeRating(), 'the wrong pick sent again is still Again').toBe(1);
        expect(reviewLogCount(), 'sent again, recorded once').toBe(1);
        // U2g: a wrong pick does not move on by itself; it waits, its answer open, for Tiếp.
        await page.waitForTimeout(1500);
        await expect(page.getByLabel(`Thẻ ${n + 1} / 4`)).toBeVisible();
        await expect(next).toBeEnabled();
        await page.keyboard.press('Enter');
      } else {
        const pickedAt = Date.now();
        await choices.getByRole('button', { name: /約束/ }).click();
        await expect(choices.getByRole('button', { name: /約束/ })).toBeDisabled();
        // Answered: the translation sits right under the sentence it translates.
        const sentence = (await page.locator('main p[lang="ja"]').first().boundingBox())!;
        await expect(translation).toHaveCount(1);
        const under = (await translation.boundingBox())!;
        expect(under.y).toBeGreaterThan(sentence.y);
        expect(under.y - (sentence.y + sentence.height)).toBeLessThan(48);
        // U2g: a right pick moves on by itself after a moment (1.2s), long enough to see it marked
        // right; Tiếp is there for the impatient.
        await expect(next).toBeVisible();
        await expect(next).toBeHidden({ timeout: 3000 });
        expect(Date.now() - pickedAt, 'the right pick stays a moment').toBeGreaterThan(1000);
      }
    } else if (await seen.isVisible()) {
      // Met inside its sentence, the answer already open with the translation.
      sawIntro = true;
      await expect(page.getByText('旅行')).toBeVisible();
      await expect(page.getByText('Tôi chuẩn bị cho chuyến đi.')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Chấm thẻ' })).toHaveCount(0);
      if (keyboard) await page.keyboard.press('Enter');
      else await seen.click();
    } else {
      if (await page.getByText('Mục này chưa có câu ví dụ.').isVisible()) sawBare++;
      if (keyboard) {
        await page.keyboard.press('Enter');
        await expect(page.getByRole('group', { name: 'Chấm thẻ' }).getByRole('button')).toHaveCount(
          4,
        );
        const key = flipKeys.shift()!;
        await page.keyboard.press(key);
        if (key === '1') {
          // U2f: Z takes the grade back, unsent: the same card with its answer open, to grade again.
          await page.keyboard.press('z');
          await expect(page.getByLabel(`Thẻ ${n + 1} / 4`)).toBeVisible();
          await expect(
            page.getByRole('group', { name: 'Chấm thẻ' }).getByRole('button'),
          ).toHaveCount(4);
          await page.keyboard.press(key);
        }
      } else {
        await reveal.click();
        // U2c: the grades take the answers' place. Phone: two columns at the foot of the screen,
        // the misses left, the hits right. Laptop: one row of four under the card; the key hints
        // sit in the side panel from 1280px (layout C).
        const bar = page.getByRole('group', { name: 'Chấm thẻ' });
        const boxes = await Promise.all(
          (await bar.getByRole('button').all()).map(async (b) => (await b.boundingBox())!),
        );
        const viewport = page.viewportSize()!;
        if (viewport.width < 640) {
          const box = (await bar.boundingBox())!;
          expect(box.y + box.height).toBeGreaterThan(viewport.height - 80);
          expect(boxes[0].x).toBe(boxes[1].x);
          expect(boxes[2].x).toBeGreaterThan(boxes[0].x);
        } else {
          expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
          const hints = page
            .getByRole('complementary', { name: 'Buổi ôn này' })
            .getByText('Phím tắt');
          if (viewport.width >= 1280) await expect(hints).toBeVisible();
          else await expect(hints).toBeHidden();
        }
        await page.getByRole('button', { name: /^Nhớ/ }).click();
      }
    }
    // U2e: the next card shows without waiting for the server.
    if (n < 3) await expect(page.getByLabel(`Thẻ ${n + 2} / 4`)).toBeVisible();
  }

  if (keyboard) {
    // The two misses (the wrong cloze, the flip graded Quên) come back once more, ungraded.
    for (let n = 0; n < 2; n++) {
      await expect(page.getByLabel(`Làm lại ${n + 1} / 2`)).toBeVisible();
      const choices = page.getByRole('group', { name: 'Chọn đáp án' });
      if (await choices.isVisible()) {
        const labels = await choices.getByRole('button').allTextContents();
        await page.keyboard.press(String(labels.findIndex((t) => t.includes('約束')) + 1));
      } else {
        await page.keyboard.press(' ');
        await expect(page.getByRole('group', { name: 'Chấm thẻ' })).toHaveCount(0);
      }
      await page.keyboard.press('Enter');
    }
    // Grades reach the server behind the session; practice answers are never sent.
    await expect.poll(reviewLogCount, { message: 'practice answers are not graded' }).toBe(4);
    // (Once over, the bar shows the graded round, checked below, not the retry round.)
  }

  await expect(page.getByText('Xong buổi ôn')).toBeVisible();
  // Over, after a retry round or not, the count under the title says nothing is left (it used to
  // keep "Còn 1 thẻ" after the retry round).
  await expect(page.getByText('Đã ôn hết thẻ đến hạn')).toBeVisible();
  // The intro card is not counted as remembered: it was read, not tested.
  await expect(
    page.getByText(
      keyboard ? /Nhớ 1 trên 3 thẻ từ vựng\. Đã làm quen 1 mục mới/ : /Nhớ 3 trên 3 thẻ từ vựng\./,
    ),
  ).toBeVisible();
  // Over, the bar shows the graded round again: a card missed there stays red after the retry.
  const bar = page.getByRole('progressbar', { name: 'Thẻ 4 / 4' });
  await expect(bar).toHaveAttribute('aria-valuenow', '4');
  await expect(bar.locator('.bg-destructive')).toHaveCount(keyboard ? 2 : 0);
  // U2d: three figures, the cards to look at again, each a link to its page.
  // The side panel (layout C, from 1280px) has its own Nhớ: read the summary's figures only.
  const tiles = page.locator('main dl').filter({ hasText: 'Đã ôn' });
  // The intro was read, not tested: Đã ôn counts the three tested cards, as the sentence does.
  await expect(tiles.getByText('Đã ôn', { exact: true }).locator('xpath=..')).toContainText(
    '3 thẻ',
  );
  await expect(tiles.getByText('Nhớ', { exact: true }).locator('xpath=..')).toContainText(
    keyboard ? '33%' : '100%',
  );
  // The streak is read once the session is over and every grade is in; every answer here was today.
  await expect(tiles.getByText('Chuỗi', { exact: true }).locator('xpath=..')).toContainText(
    '1 ngày',
  );
  const again = page.getByRole('region', { name: 'Xem lại thẻ chưa nhớ' });
  if (keyboard) {
    // The wrong cloze and the flip graded Quên; the remembered ones and the intro are not listed.
    await expect(again.getByRole('link')).toHaveCount(2);
    await expect(again.getByRole('link').first()).toContainText('約束');
    await expect(again.getByRole('link').first()).toHaveAttribute('href', '/resources/q1');
  } else {
    await expect(again).toHaveCount(0);
  }
  expect(ratings()).toEqual(keyboard ? [1, 1, 3, 4] : [3, 3, 3, 3]);
  expect(sawCloze, 'the seen word is tested as a cloze').toBe(true);
  expect(sawIntro, 'a new word is met on an intro card').toBe(true);
  expect(sawBare, 'a word with no sentence says so').toBe(2);
  expect(reviewLogCount()).toBe(4);
  if (laptop) {
    // The intro card is left out of the panel's counts too.
    await expect(count('Nhớ')).toHaveText(keyboard ? '1' : '3');
    await expect(count('Chưa nhớ')).toHaveText(keyboard ? '2' : '0');
    await expect(count('Còn')).toHaveText('0');
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

test.beforeAll(seedE2eAccount);

test('quick review on desktop: cloze for a seen word, intro for a new one, every answer recorded', async ({
  page,
}) => {
  seed();
  await runSession(page);
});

test('quick review by keyboard, and a lost answer is sent again as it was', async ({ page }) => {
  seed();
  await runSession(page, { keyboard: true });
});

// U2e: on a slow server every card still follows the grade at once, and the grades arrive behind.
test('a grade moves on at once and is saved behind the session', async ({ page }) => {
  seed();
  await login(page);
  await page.goto('/review');
  await page.route('**/review', async (route) => {
    const req = route.request();
    if (!isAction(req.method(), req.headers())) return route.continue();
    await new Promise((r) => setTimeout(r, 1500));
    return route.continue().catch(() => {});
  });

  for (let n = 0; n < 4; n++) {
    await expect(page.getByLabel(`Thẻ ${n + 1} / 4`)).toBeVisible();
    const choices = page.getByRole('group', { name: 'Chọn đáp án' });
    const reveal = page.getByRole('button', { name: 'Xem đáp án' });
    const seen = page.getByRole('button', { name: 'Đã xem' });
    await expect(choices.or(reveal).or(seen)).toBeVisible();
    let last;
    if (await choices.isVisible()) {
      await choices.getByRole('button', { name: /約束/ }).click();
      last = page.getByRole('button', { name: 'Tiếp' });
      // Picked, the next step is open before the server has answered.
      await expect(last).toBeEnabled({ timeout: 400 });
    } else if (await seen.isVisible()) {
      last = seen;
    } else {
      await reveal.click();
      last = page.getByRole('button', { name: /^Nhớ/ });
    }
    const before = Date.now();
    await last.click();
    const nextShown = n < 3 ? page.getByLabel(`Thẻ ${n + 2} / 4`) : page.getByText('Xong buổi ôn');
    await expect(nextShown).toBeVisible({ timeout: 400 });
    expect(Date.now() - before, 'the next card shows under 400ms').toBeLessThan(400);
  }
  // Nothing failed, so nothing is said about saving; the grades land in order behind.
  await expect(page.getByRole('status').filter({ hasText: 'Chưa lưu' })).toHaveCount(0);
  await expect.poll(reviewLogCount, { timeout: 10_000 }).toBe(4);
  expect(ratings()).toEqual([3, 3, 3, 3]);
});

// Answers the card on screen right. A flip or an intro is held for undo; a cloze is not.
async function answerRight(page: Page): Promise<'held' | 'sent'> {
  const choices = page.getByRole('group', { name: 'Chọn đáp án' });
  const reveal = page.getByRole('button', { name: 'Xem đáp án' });
  const seen = page.getByRole('button', { name: 'Đã xem' });
  await expect(choices.or(reveal).or(seen)).toBeVisible();
  if (await choices.isVisible()) {
    // A right pick moves on by itself (U2g).
    await choices.getByRole('button', { name: /約束/ }).click();
    return 'sent';
  }
  if (await seen.isVisible()) await seen.click();
  else {
    await reveal.click();
    await page.getByRole('button', { name: /^Nhớ/ }).click();
  }
  return 'held';
}

// U2f: the last grade waits on the device until the next one, so it can be taken back.
test('Hoàn tác takes the last grade back, and one held as the page closes still lands', async ({
  page,
}) => {
  seed();
  await login(page);
  await page.goto('/review');
  const undo = page.getByRole('button', { name: 'Hoàn tác' });
  let graded = 0;
  let tookBack = false;
  for (let n = 0; n < 3; n++) {
    await expect(page.getByLabel(`Thẻ ${n + 1} / 4`)).toBeVisible();
    const how = await answerRight(page);
    graded++;
    if (how === 'sent') {
      // A cloze pick is never held: its answer was on screen.
      await expect(undo).toHaveCount(0);
      continue;
    }
    await expect(undo).toBeVisible();
    if (!tookBack) {
      tookBack = true;
      await undo.click();
      await expect(page.getByLabel(`Thẻ ${n + 1} / 4`)).toBeVisible();
      await expect(undo).toHaveCount(0);
      // Taken back before it was sent: the review log never sees it.
      await expect.poll(reviewLogCount).toBe(graded - 1);
      const again = page.getByRole('button', { name: /^Nhớ|^Đã xem/ }).first();
      await again.click();
      await expect(undo).toBeVisible();
    }
  }
  // The last grade is still held. Leaving the page hands it to the browser, which sends it.
  await expect.poll(reviewLogCount).toBe(graded - 1);
  await page.goto('/');
  await expect.poll(reviewLogCount, { timeout: 10_000 }).toBe(graded);
  expect(ratings()).toEqual([3, 3, 3]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('quick review at 390px: the same session fits without sideways scroll', async ({ page }) => {
    seed();
    await runSession(page);
  });
});
