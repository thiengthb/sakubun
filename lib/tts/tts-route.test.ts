import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// /api/tts with the audio cache (K6a): VOICEVOX reads a sentence once, then the file answers.
const dir = mkdtempSync(path.join(tmpdir(), 'sakubun-tts-route-'));
vi.mock('@/lib/auth/current-user', () => ({ routeUserId: async () => 'learner' }));

const engine = vi.fn(async (url: string) =>
  url.includes('/audio_query')
    ? new Response(JSON.stringify({ speedScale: 1 }))
    : new Response(new Uint8Array([82, 73, 70, 70, 1, 2, 3])),
);
let GET: (req: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv('TTS_CACHE_DIR', dir);
  vi.stubGlobal('fetch', engine);
  ({ GET } = await import('@/app/api/tts/route'));
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

const play = (query: string, headers?: HeadersInit) =>
  GET(new Request(`http://localhost/api/tts?${query}`, { headers }));

describe('/api/tts audio cache', () => {
  it('asks VOICEVOX once per sentence, voice and speed, then serves the stored file', async () => {
    const first = await play('text=来月のシフト？&speaker=3');
    expect(first.status).toBe(200);
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(
      new Uint8Array([82, 73, 70, 70, 1, 2, 3]),
    );
    expect(engine).toHaveBeenCalledTimes(2); // audio_query + synthesis

    const again = await play('text=来月のシフト？&speaker=3');
    expect(new Uint8Array(await again.arrayBuffer())).toHaveLength(7);
    const ranged = await play('text=来月のシフト？&speaker=3', { range: 'bytes=0-3' });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('content-range')).toBe('bytes 0-3/7');
    expect(engine).toHaveBeenCalledTimes(2);

    await play('text=来月のシフト？&speaker=13');
    await play('text=来月のシフト？&speaker=3&rate=0.6');
    expect(engine).toHaveBeenCalledTimes(6);
    expect(readdirSync(dir).filter((n) => n.endsWith('.wav'))).toHaveLength(3);
  });

  it('reads in voice 0 when asked, and in the default voice when no voice is given', async () => {
    const voiceOf = () => new URL(String(engine.mock.calls.at(-1)![0])).searchParams.get('speaker');
    await play('text=声ゼロ&speaker=0');
    expect(voiceOf()).toBe('0');
    await play('text=声なし');
    expect(voiceOf()).toBe('2');
    await play('text=声が変&speaker=abc');
    expect(voiceOf()).toBe('2');
  });

  it('stores nothing when VOICEVOX fails', async () => {
    engine.mockImplementationOnce(async () => new Response('down', { status: 500 }));
    expect((await play('text=失敗')).status).toBe(503);
    expect(readdirSync(dir).filter((n) => n.endsWith('.wav'))).toHaveLength(6);
  });
});
