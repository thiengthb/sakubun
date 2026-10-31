import { routeUserId } from '@/lib/auth/current-user';
import { audioCache } from '@/lib/tts/audio-cache';
import { cacheDir, cacheKey, cacheMaxBytes } from '@/lib/tts/cache-policy';

const ENGINE = process.env.VOICEVOX_URL ?? 'http://voicevox:50021';
const DEFAULT_SPEAKER = Number(process.env.VOICEVOX_SPEAKER ?? '2');
const MAX_CHARS = 200; // a reference sentence is short; cap so one call can't tie up the CPU engine
const TIMEOUT_MS = 15_000;

// Readings VOICEVOX has made once, kept on the data volume (K6a): the next play is a file read.
const cache = audioCache(cacheDir(process.env), cacheMaxBytes(process.env.TTS_CACHE_MAX_MB));

async function synthesize(
  text: string,
  speaker: number,
  rate: number,
): Promise<Response | Uint8Array<ArrayBuffer>> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const queryRes = await fetch(
    `${ENGINE}/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`,
    { method: 'POST', signal },
  );
  if (!queryRes.ok) return new Response('tts query failed', { status: 503 });
  let query = await queryRes.text();
  if (rate !== 1) {
    try {
      const parsed = JSON.parse(query) as { speedScale?: number };
      parsed.speedScale = rate;
      query = JSON.stringify(parsed);
    } catch {}
  }

  const synthRes = await fetch(`${ENGINE}/synthesis?speaker=${speaker}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: query,
    signal,
  });
  if (!synthRes.ok) return new Response('tts synthesis failed', { status: 503 });
  return new Uint8Array(await synthRes.arrayBuffer());
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Only for signed-in learners: the engine is a CPU on the NUC (roadmap 7.2a).
  const caller = await routeUserId('learner');
  if (caller instanceof Response) return caller;

  const url = new URL(req.url);
  const text = url.searchParams.get('text')?.trim().slice(0, MAX_CHARS);
  if (!text) return new Response('missing text', { status: 400 });
  // Voice 0 is a real voice (四国めたん); only a missing or malformed value takes the default.
  const speakerParam = Number(url.searchParams.get('speaker') || NaN);
  const speaker =
    Number.isInteger(speakerParam) && speakerParam >= 0 ? speakerParam : DEFAULT_SPEAKER;
  const rateRaw = url.searchParams.get('rate');
  const rateNum = rateRaw != null ? Number(rateRaw) : NaN;
  const rate = Number.isFinite(rateNum) && rateNum > 0 ? Math.min(2, Math.max(0.5, rateNum)) : 1;

  try {
    const key = cacheKey({ text, speaker, rate });
    let audio = await cache.get(key);
    if (!audio) {
      const made = await synthesize(text, speaker, rate);
      if (made instanceof Response) return made;
      audio = made;
      await cache.put(key, audio);
    }
    const base: Record<string, string> = {
      'content-type': 'audio/wav',
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=86400',
    };

    const range = req.headers.get('range');
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Math.min(Number(m[2]), audio.length - 1) : audio.length - 1;
        if (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          start <= end &&
          start < audio.length
        ) {
          const slice = audio.subarray(start, end + 1);
          return new Response(slice, {
            status: 206,
            headers: {
              ...base,
              'content-length': String(slice.length),
              'content-range': `bytes ${start}-${end}/${audio.length}`,
            },
          });
        }
        return new Response(null, {
          status: 416,
          headers: { ...base, 'content-range': `bytes */${audio.length}` },
        });
      }
    }

    return new Response(audio, {
      headers: { ...base, 'content-length': String(audio.length) },
    });
  } catch {
    return new Response('tts unavailable', { status: 503 });
  }
}
