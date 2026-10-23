import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');

const card = (ja: string, vi: string, jaRuby: string) =>
  JSON.stringify({ structure: [], usage: 'u', example: { ja, vi, jaRuby }, pitfalls: [] });

// One seen word that can be clozed, and three new words: the cloze's distractors, met as flip cards.
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
    const item = db.prepare(
      `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt, challengeObservations, enrichment)
       VALUES (?, 'VOCAB', ?, ?, NULL, ?, 'N5', NULL, 'MCP', NULL, 0, 0, ?, 0, ?)`,
    );
    const srs = db.prepare(
      `INSERT INTO SrsState (id, itemId, due, stability, difficulty, scheduledDays, learningSteps,
         reps, lapses, state, lastReview)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
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
    const fresh: [string, string, string, string | null][] = [
      [
        'q2',
        '準備',
        'chuẩn bị',
        card(
          '旅行の準備をします。',
          'Tôi chuẩn bị cho chuyến đi.',
          '旅行[りょこう]の準備[じゅんび]をします。',
        ),
      ],
      ['q3', '練習', 'luyện tập', null],
      ['q4', '連絡', 'liên lạc', null],
    ];
    fresh.forEach(([id, expression, meaning, enrichment], n) => {
      item.run(id, expression, null, meaning, iso(now - (3 - n) * 1000), enrichment);
      srs.run(`s${id}`, id, iso(now), 0, 0, 0, 0, 0, null);
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
// the network and sent again, and the three flips are graded with 1, 2 and Enter.
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
  let sawSentence = false;
  const flipKeys = ['1', '2', 'Enter'];
  for (let n = 0; n < 4; n++) {
    await expect(page.getByLabel(`Thẻ ${n + 1} / 4`)).toBeVisible();
    const choices = page.getByRole('group', { name: 'Chọn đáp án' });
    const reveal = page.getByRole('button', { name: 'Xem đáp án' });
    await expect(choices.or(reveal)).toBeVisible();
    if (await choices.isVisible()) {
      sawCloze = true;
      await expect(choices.getByRole('button')).toHaveCount(4);
      await expect(page.getByLabel('chỗ trống')).toBeVisible();
      await expect(page.locator('main p[lang="ja"]').first()).not.toContainText('約束');
      const next = page.getByRole('button', { name: 'Tiếp' });
      if (keyboard) {
        const labels = await choices.getByRole('button').allTextContents();
        const wrong = String(labels.findIndex((t) => !t.includes('約束')) + 1);
        dropNext = true;
        await page.keyboard.press(wrong);
        await expect(page.getByText('Mất kết nối, chưa lưu được.')).toBeVisible();
        // The answer is on screen now, so the same pick is sent again; the choices stay shut.
        await expect(choices.getByRole('button').first()).toBeDisabled();
        expect(reviewLogCount()).toBe(0);
        await expect(page.getByRole('button', { name: 'Gửi lại' })).toBeEnabled();
        await page.keyboard.press('Enter');
        await expect(next).toBeEnabled();
        expect(clozeRating(), 'the wrong pick sent again is still Again').toBe(1);
        await expect(page.getByText('Chưa đúng, tính là Chưa nhớ.')).toBeVisible();
        await page.keyboard.press('Enter');
      } else {
        await choices.getByRole('button', { name: /約束/ }).click();
        await expect(page.getByText('Đúng, tính là Nhớ.')).toBeVisible();
        await next.click();
      }
    } else {
      if (await page.getByText('旅行').isVisible()) sawSentence = true;
      if (keyboard) {
        await page.keyboard.press('Enter');
        await expect(page.getByRole('button', { name: /^Nhớ/ })).toBeVisible();
        await page.keyboard.press(flipKeys.shift()!);
      } else {
        await reveal.click();
        await page.getByRole('button', { name: /^Nhớ/ }).click();
      }
    }
    // The next card only shows once the server has recorded this answer.
    if (n < 3) await expect(page.getByLabel(`Thẻ ${n + 2} / 4`)).toBeVisible();
  }

  await expect(page.getByText('Xong buổi ôn')).toBeVisible();
  await expect(page.getByText(keyboard ? '2 trên 4 thẻ nhớ' : '4 trên 4 thẻ nhớ')).toBeVisible();
  expect(sawCloze, 'the seen word is tested as a cloze').toBe(true);
  expect(sawSentence, 'a new word with an example is met inside its sentence').toBe(true);
  expect(reviewLogCount()).toBe(4);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

test.beforeAll(seedE2eAccount);

test('quick review on desktop: cloze for a seen word, flip for new ones, every answer recorded', async ({
  page,
}) => {
  seed();
  await runSession(page);
});

test('quick review by keyboard, and a lost answer is sent again as it was', async ({ page }) => {
  seed();
  await runSession(page, { keyboard: true });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('quick review at 390px: the same session fits without sideways scroll', async ({ page }) => {
    seed();
    await runSession(page);
  });
});
