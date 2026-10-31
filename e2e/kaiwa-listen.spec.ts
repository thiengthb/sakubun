import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// K6b and K6c (docs/plans/2026-10-31-k6-kaiwa-listening.md): "Nghe cả bài" plays a script's lines
// in order, each speaker in a voice of their own; with "Che câu của tôi" on, the learner's covered
// line waits for them, then opens and plays; Space pauses and Esc stops.
const BODY = [
  '店の中は静かだった。 | Trong quán yên tĩnh.',
  'A: いらっしゃいませ。 | Xin mời vào.',
  'B: 二人です。 | Hai người.',
  'A: こちらへどうぞ。 | Mời đi lối này.',
].join('\n');
const SENTENCES = ['店の中は静かだった。', 'いらっしゃいませ。', '二人です。', 'こちらへどうぞ。'];

// A tenth of a second of silence: VOICEVOX is not running in e2e, and a real WAV lets the page's
// <audio> play to its end.
function silentWav(): Buffer {
  const rate = 8000;
  const samples = rate / 10;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  return wav;
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

// Every reading the page played, in order: the sentence and the voice. The early fetches for the
// next lines are left out; only the <audio> element's own requests count.
async function recordSpeech(page: Page) {
  const asked: { text: string; speaker: string | null }[] = [];
  const wav = silentWav();
  await page.route('**/api/tts**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().resourceType() === 'media')
      asked.push({
        text: url.searchParams.get('text') ?? '',
        speaker: url.searchParams.get('speaker'),
      });
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
  });
  return asked;
}

test.beforeAll(async () => {
  await seedE2eAccount();
  const d = new Database(path.join(process.cwd(), E2E_DB_FILE));
  d.exec(`DELETE FROM Script WHERE id = 'kw-listen'`);
  const now = new Date().toISOString();
  d.prepare(
    `INSERT INTO Script (id, userId, title, body, analysis, version, createdAt, updatedAt)
     VALUES ('kw-listen', ${E2E_OWNER}, 'Nghe cả bài', ?, NULL, 1, ?, ?)`,
  ).run(BODY, now, now);
  d.close();
});

test('Nghe cả bài plays every line in order, A and B in different voices', async ({ page }) => {
  const asked = await recordSpeech(page);
  await signIn(page);
  await page.goto('/kaiwa/kw-listen', { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'A' }).click();

  await page.getByRole('button', { name: 'Nghe cả bài' }).click();
  await expect(page.getByRole('button', { name: 'Tạm dừng' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nghe cả bài' })).toBeVisible({ timeout: 20_000 });

  // Each line played once, in order.
  const order = [...new Set(asked.map((a) => a.text))];
  expect(order).toEqual(SENTENCES);
  const voice = (text: string) => asked.find((a) => a.text === text)!.speaker;
  expect(voice('いらっしゃいませ。')).toBe(voice('こちらへどうぞ。'));
  expect(voice('いらっしゃいませ。')).toBe(voice('店の中は静かだった。'));
  expect(voice('二人です。')).not.toBe(voice('いらっしゃいませ。'));
  // The last line played is the one ringed.
  await expect(page.locator('[data-slot="kaiwa-line"]').nth(3).locator('.ring-2')).toHaveCount(1);
});

test("with the learner's lines covered, each waits, then opens and plays", async ({ page }) => {
  await recordSpeech(page);
  await signIn(page);
  await page.goto('/kaiwa/kw-listen', { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'A' }).click();
  await page.getByRole('button', { name: 'Che câu của tôi' }).click();
  const lines = page.locator('[data-slot="kaiwa-line"]');
  const covered = page.locator('[data-slot="kaiwa-covered"]');
  await expect(covered).toHaveCount(2);

  // Start from A's first line: the learner's turn comes first, the sentence stays hidden.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.getByRole('button', { name: 'Nghe cả bài' }).click();
  await expect(lines.nth(1)).toContainText('Bấm để xem câu tiếng Nhật');
  await expect(lines.nth(1)).toContainText('いらっしゃいませ', { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Nghe cả bài' })).toBeVisible({ timeout: 20_000 });
  await expect(covered).toHaveCount(0);
});

test('Space pauses and resumes, Esc stops', async ({ page }) => {
  await recordSpeech(page);
  await signIn(page);
  await page.goto('/kaiwa/kw-listen', { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'A' }).click();
  await page.getByRole('button', { name: 'Che câu của tôi' }).click();
  // A covered line holds the learner's turn for two seconds or more: time to press the keys.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.getByRole('button', { name: 'Nghe cả bài' }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeVisible();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Tạm dừng' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Nghe cả bài' })).toBeVisible();
});
