import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

const STORED = '毎朝コーヒーを飲みます。';
const CARD_EXAMPLE = 'お茶を飲みました。';
const CARD_EXAMPLE_VI = 'Đã uống trà.';

const CARD = JSON.stringify({
  structure: [],
  usage: 'Động từ nhóm 1, tha động từ: 〜を飲む.',
  collocations: [],
  example: { ja: '水を飲む。', vi: 'Uống nước.', jaRuby: '水[みず]を飲[の]む。' },
  examples: [{ ja: CARD_EXAMPLE, vi: 'Đã uống trà.', jaRuby: 'お茶[ちゃ]を飲[の]みました。' }],
  pitfalls: [],
  contrasts: [],
  synonyms: [],
  antonyms: [],
  register: '',
  v: 3,
});

const ID = 'vocab-examples';

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    db.prepare('DELETE FROM Item WHERE id = ?').run(ID);
    db.prepare(
      `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
                         captureReason, suspended, starred, createdAt, enrichment)
       VALUES (${E2E_OWNER}, ?, 'VOCAB', '飲む', 'のむ', 'ẩm', 'uống', 'N5', ?, 'MCP', NULL, 0, 0, ?, ?)`,
    ).run(ID, STORED, new Date().toISOString().replace('Z', '+00:00'), CARD);
  } finally {
    db.close();
  }
});

test('chi tiết từ vựng: một mục «Ví dụ», và không câu nào bị mất', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto(`/resources/${ID}`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /Chi tiết/ }).click();

  await expect(page.getByText('Ví dụ', { exact: true })).toHaveCount(1);

  const body = page.locator('body');
  await expect(body).toContainText(CARD_EXAMPLE_VI);
  await expect(body).toContainText(STORED);
});
