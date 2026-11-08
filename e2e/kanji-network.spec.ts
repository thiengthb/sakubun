import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// KJ6 (docs/plans/2026-11-08-kanji.md › Bộ thủ và mạng lưới): a kanji's page draws its component
// network on a laptop and lists it by part on a phone; every kanji in it opens its own page.

function seed() {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}" WHERE userId = ${E2E_OWNER}`);
    // 語 is remembered, so it shows green around 吾.
    db.prepare(
      `INSERT INTO Item (userId, id, kind, expression, hanviet, meaningVi, level, source, suspended, starred, createdAt)
       VALUES (${E2E_OWNER}, 'k1', 'KANJI', '語', 'NGỮ', 'lời nói', 'N5', 'JOYO', 0, 0, ?)`,
    ).run(new Date().toISOString());
    db.prepare(
      `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays, learningSteps, reps, lapses, state)
       VALUES (${E2E_OWNER}, 's1', 'k1', ?, 4, 5, 3, 0, 2, 0, 2)`,
    ).run(new Date(Date.now() + 86_400_000).toISOString());
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
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => (a as CSSAnimation).animationName === 'kanji-stroke')
        .map((a) => a.finished),
    ),
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
};

test.beforeEach(async () => {
  await seedE2eAccount();
  seed();
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`a kanji's page shows its component network (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page);
    // From the Kanji tab: a tile, its dialog, then its page.
    await page.goto('/resources?tab=kanji', { waitUntil: 'networkidle' });
    await page.getByRole('searchbox', { name: 'Tìm kanji' }).fill('悟');
    await page.getByRole('button', { name: '悟 [NGỘ]' }).click();
    await page.getByRole('link', { name: 'Mạng lưới thành phần' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('悟 [NGỘ]');

    // 悟 = 忄 (the radical tâm) + 吾; 吾 gives the sound and links on to 語, which the learner
    // remembers. 吾 is not Jōyō, so it has no Hán Việt of its own here.
    await expect(page.getByRole('region', { name: 'Chữ có thành phần 忄 tâm' })).toBeVisible();
    const sound = page.getByRole('region', { name: 'Chữ có thành phần 吾, phần chỉ âm' });
    await expect(sound).toBeVisible();
    await expect(sound.getByRole('link', { name: '語 [NGỮ], đã nhớ' })).toBeVisible();
    const drawing = page.locator('[data-slot="kanji-network"]');
    if (width >= 768) await expect(drawing).toBeVisible();
    else await expect(drawing).toBeHidden();
    await shot(page, `kanji-mang-luoi-${width}`);

    await sound.getByRole('link', { name: '語 [NGỮ], đã nhớ' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('語 [NGỮ]');
    await expect(
      page.getByRole('region', { name: /^Chữ có thành phần 言 \[NGÔN\]$/ }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });
}

test('a part with many kanji shows twelve, then the rest on "Xem thêm"', async ({ page }) => {
  await signIn(page);
  await page.goto(`/resources/kanji/${encodeURIComponent('語')}`, { waitUntil: 'networkidle' });
  const speech = page.getByRole('region', { name: /^Chữ có thành phần 言 \[NGÔN\]$/ });
  await expect(speech.getByRole('listitem')).toHaveCount(12);
  await speech.getByRole('button', { name: /^Xem thêm \d+ chữ$/ }).click();
  expect(await speech.getByRole('listitem').count()).toBeGreaterThan(12);
});
