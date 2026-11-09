import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import {
  E2E_DB_FILE,
  E2E_EMAIL,
  E2E_LOGIN,
  E2E_OWNER,
  seedE2eAccount,
  setFurigana,
} from './fixtures';

// thien, 2026-11-07: the sidebar's furigana switch (in the user menu since UI v2) is the only one. On shows every reading at once,
// with no hover; off hides them all, a hover included. Ôn nhanh no longer has its own button, which
// used to win over the sidebar.

function seed() {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    const example = JSON.stringify({
      structure: [],
      usage: 'u',
      example: {
        ja: '旅行の準備をします。',
        vi: 'Tôi chuẩn bị cho chuyến đi.',
        jaRuby: '旅行[りょこう]の準備[じゅんび]をします。',
      },
      pitfalls: [],
    });
    db.prepare(
      `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt, enrichment)
       VALUES (${E2E_OWNER}, 'f1', 'VOCAB', '準備', 'じゅんび', NULL, 'chuẩn bị', 'N5', NULL, 'MCP', NULL,
         0, 0, ?, ?)`,
    ).run(new Date(now - 4 * 86_400_000).toISOString(), example);
    db.prepare(
      `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays,
         learningSteps, reps, lapses, state, lastReview)
       VALUES (${E2E_OWNER}, 'sf1', 'f1', ?, 4, 5, 3, 0, 2, 0, 2, ?)`,
    ).run(new Date(now - 86_400_000).toISOString(), new Date(now - 4 * 86_400_000).toISOString());
  } finally {
    db.close();
  }
}

test('the furigana switch in the user menu alone shows or hides every reading, with no hover in between', async ({
  page,
}) => {
  await seedE2eAccount();
  seed();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/review', { waitUntil: 'networkidle' });

  await expect(page.getByRole('button', { name: 'Bật tắt furigana' })).toHaveCount(0);
  await setFurigana(page, true);

  const readings = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('main rt')].map((rt) => getComputedStyle(rt).visibility),
    );
  await page.mouse.move(0, 0);
  await expect.poll(readings).toContain('visible');
  expect(new Set(await readings())).toEqual(new Set(['visible']));

  await setFurigana(page, false);
  await expect.poll(async () => [...new Set(await readings())]).toEqual(['hidden']);
  // A hover does not bring a reading back.
  const sentence = page.locator('main p[lang="ja"]').first();
  await sentence.hover();
  expect(new Set(await readings())).toEqual(new Set(['hidden']));
  // Off stays off after a reload.
  await page.reload({ waitUntil: 'networkidle' });
  await expect.poll(async () => [...new Set(await readings())]).toEqual(['hidden']);

  await setFurigana(page, true);
  await page.mouse.move(0, 0);
  await expect.poll(async () => [...new Set(await readings())]).toEqual(['visible']);
});
