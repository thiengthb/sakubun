import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// Kaiwa c (docs/plans/2026-11-07-kaiwa-voices-roleplay.md): "Giọng từng vai" in the Thao tác menu
// opens a page that sets a voice per part on one script; a chosen voice wins over the one worked out, and Nghe cả
// bài plays each part in it.
const BODY = [
  'A: いらっしゃいませ。 | Xin mời vào.',
  'B: 二人です。 | Hai người.',
  'A: こちらへどうぞ。 | Mời đi lối này.',
].join('\n');
const STRONG_MALE = 21; // 'Nam · mạnh (剣崎雌雄)'

function db() {
  return new Database(path.join(process.cwd(), E2E_DB_FILE));
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

// Every reading played through <audio>: the sentence and the voice. VOICEVOX is not running in
// e2e, so each answer is a tenth of a second of silence.
async function recordSpeech(page: Page) {
  const asked: { text: string; speaker: string | null }[] = [];
  const samples = 800;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  await page.route('**/api/tts**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('timing') === '1') return route.fulfill({ status: 404, body: '' });
    if (route.request().resourceType() === 'media')
      asked.push({
        text: url.searchParams.get('text') ?? '',
        speaker: url.searchParams.get('speaker'),
      });
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
  });
  return asked;
}

test.beforeEach(async () => {
  await seedE2eAccount();
  const d = db();
  d.exec(`DELETE FROM Script WHERE id = 'kw-voices'`);
  const now = new Date().toISOString();
  d.prepare(
    `INSERT INTO Script (id, userId, title, body, analysis, version, createdAt, updatedAt)
     VALUES ('kw-voices', ${E2E_OWNER}, 'Ở quán', ?, NULL, 1, ?, ?)`,
  ).run(BODY, now, now);
  d.close();
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`a voice chosen for a part is saved and played (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const asked = await recordSpeech(page);
    await signIn(page);
    await page.goto('/kaiwa/kw-voices', { waitUntil: 'networkidle' });
    await page.getByRole('radio', { name: 'A' }).click();
    const shots = process.env.SCREENSHOT_DIR;

    await page.getByRole('button', { name: 'Thao tác' }).click();
    await expect(page.getByRole('menuitem', { name: 'Giọng từng vai' })).toBeVisible();
    await page.waitForTimeout(400);
    if (shots) await page.screenshot({ path: path.join(shots, `kaiwa-thao-tac-${width}.png`) });
    await page.getByRole('menuitem', { name: 'Giọng từng vai' }).click();
    await page.waitForURL('**/kaiwa/kw-voices/voices');
    await expect(page.getByRole('heading', { level: 1, name: 'Giọng từng vai' })).toBeVisible();
    // A row per part: the learner's follows Cài đặt, the other is worked out.
    const voiceA = page.getByRole('combobox', { name: 'Giọng của vai A' });
    const voiceB = page.getByRole('combobox', { name: 'Giọng của vai B' });
    await expect(voiceA).toContainText('Theo Cài đặt');
    await expect(voiceB).toContainText('Tự động');
    await expect(page.getByText('· vai của bạn')).toBeVisible();
    const save = page.getByRole('button', { name: 'Lưu' });
    await expect(save).toBeDisabled();
    await page.mouse.move(0, 0);
    if (shots)
      await page.screenshot({
        path: path.join(shots, `kaiwa-giong-tung-vai-${width}.png`),
        fullPage: true,
      });

    // Choose B's voice and hear it on B's first line before saving.
    await voiceB.click();
    await page.getByRole('option', { name: 'Nam · mạnh (剣崎雌雄)' }).click();
    await expect(save).toBeEnabled();
    await page.getByRole('button', { name: 'Nghe thử vai B' }).click();
    await expect
      .poll(() => asked.find((a) => a.text === '二人です。')?.speaker)
      .toBe(String(STRONG_MALE));
    await page.mouse.move(0, 0);
    if (shots)
      await page.screenshot({
        path: path.join(shots, `kaiwa-giong-tung-vai-da-chon-${width}.png`),
        fullPage: true,
      });
    await save.click();
    await page.waitForURL('**/kaiwa/kw-voices');
    await expect(page.getByText('Đã lưu giọng từng vai')).toBeVisible();

    const d = db();
    const row = d.prepare(`SELECT voices, version FROM Script WHERE id = 'kw-voices'`).get() as {
      voices: string;
      version: number;
    };
    d.close();
    expect(JSON.parse(row.voices)).toEqual({ B: STRONG_MALE });
    expect(row.version).toBe(1);

    // Nghe cả bài reads B in the chosen voice.
    asked.length = 0;
    await page.getByRole('button', { name: 'Nghe cả bài' }).click();
    await expect(page.getByRole('button', { name: 'Nghe cả bài' })).toBeVisible({
      timeout: 20_000,
    });
    expect(asked.find((a) => a.text === '二人です。')?.speaker).toBe(String(STRONG_MALE));

    // Back on the page, the saved choice shows; Tự động takes it back.
    await page.goto('/kaiwa/kw-voices/voices', { waitUntil: 'networkidle' });
    await expect(voiceB).toContainText('Nam · mạnh');
    await voiceB.click();
    await page.getByRole('option', { name: /^Tự động/ }).click();
    await page.getByRole('button', { name: 'Lưu' }).click();
    await page.waitForURL('**/kaiwa/kw-voices');
    await expect
      .poll(() => {
        const c = db();
        const r = c.prepare(`SELECT voices FROM Script WHERE id = 'kw-voices'`).get() as {
          voices: string | null;
        };
        c.close();
        return r.voices;
      })
      .toBeNull();
  });
}

test('Huỷ goes back to the script and saves nothing', async ({ page }) => {
  await signIn(page);
  await page.goto('/kaiwa/kw-voices/voices', { waitUntil: 'networkidle' });
  await page.getByRole('combobox', { name: 'Giọng của vai B' }).click();
  await page.getByRole('option', { name: 'Nam · mạnh (剣崎雌雄)' }).click();
  await page.getByRole('link', { name: 'Huỷ' }).click();
  await page.waitForURL('**/kaiwa/kw-voices');
  const d = db();
  const row = d.prepare(`SELECT voices FROM Script WHERE id = 'kw-voices'`).get() as {
    voices: string | null;
  };
  d.close();
  expect(row.voices).toBeNull();
});
