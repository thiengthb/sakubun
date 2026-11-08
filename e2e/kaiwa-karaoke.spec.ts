import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// Kaiwa (b), thien 2026-11-07: a line lights up as VOICEVOX reads each mora, not at an even pace.
// The reading below is silent for its first 60%, then reads its six morae quickly: an even pace
// would light half the line in that silence, the syllable karaoke none of it.
const SENTENCE = 'いただきます。';
const STARTS = [0.6, 0.62, 0.64, 0.66, 0.68, 0.7];

function silentWav(seconds: number): Buffer {
  const rate = 8000;
  const samples = Math.round(rate * seconds);
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

test.beforeAll(async () => {
  await seedE2eAccount();
  const d = new Database(path.join(process.cwd(), E2E_DB_FILE));
  d.exec(`DELETE FROM Script WHERE id = 'kw-karaoke'`);
  const now = new Date().toISOString();
  d.prepare(
    `INSERT INTO Script (id, userId, title, body, analysis, version, createdAt, updatedAt)
     VALUES ('kw-karaoke', ${E2E_OWNER}, 'Karaoke', ?, NULL, 1, ?, ?)`,
  ).run(`A: ${SENTENCE} | Tôi xin phép ăn.`, now, now);
  d.close();
});

test('a line lights up mora by mora as the voice reads it', async ({ page }) => {
  const wav = silentWav(3);
  await page.route('**/api/tts**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('timing') === '1')
      return route.fulfill({ status: 200, json: { starts: STARTS } });
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/kaiwa/kw-karaoke', { waitUntil: 'networkidle' });

  const line = page.locator('[data-slot="kaiwa-line"]').first();
  await expect(line).toContainText(SENTENCE);
  await line.getByRole('button', { name: 'Nghe câu (phát âm)' }).click();

  // How many characters are lit, sampled every 50 ms until the reading ends.
  const samples = await line.evaluate(async (el) => {
    const out: { t: number; lit: number }[] = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 4000) {
      out.push({
        t: performance.now() - t0,
        lit: el.querySelectorAll('span[lang="ja"] span.text-accent-brand').length,
      });
      await new Promise((r) => setTimeout(r, 50));
    }
    return out;
  });
  const first = samples.find((s) => s.lit > 0);
  expect(first, 'the line never lit up').toBeTruthy();
  // Nothing lights in the silence: an even pace would light a character every ~0.4 s from the start.
  expect(first!.t).toBeGreaterThan(1500);
  // Then the six morae, read within 0.3 s, light the whole line (with its 。) almost at once.
  const full = samples.find((s) => s.lit === [...SENTENCE].length);
  expect(full, 'the whole line never lit up').toBeTruthy();
  expect(full!.t - first!.t).toBeLessThan(600);
});
