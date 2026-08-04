// Local TTS proxy → VOICEVOX engine (neural Japanese voice, runs as a sibling container). The browser
// hits this GET route and plays the returned WAV in an <audio> element, so the voice is natural AND
// identical on EVERY browser — no dependence on the OS/browser speechSynthesis voices (which are often
// robotic on Firefox/Linux). If the engine is unreachable this returns 503 and the client falls back to
// Web Speech. Kept server-side so the engine stays internal to the compose network (never exposed).

const ENGINE = process.env.VOICEVOX_URL ?? 'http://voicevox:50021';
// VOICEVOX speaker id (voice). 2 = 四国めたん (ノーマル) — a clear, neutral standard-Japanese voice.
// Overridable per-request (?speaker=) or via env for a different default.
const DEFAULT_SPEAKER = Number(process.env.VOICEVOX_SPEAKER ?? '2');
const MAX_CHARS = 200; // a reference sentence is short; cap so one call can't tie up the CPU engine
const TIMEOUT_MS = 15_000;

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = url.searchParams.get('text')?.trim().slice(0, MAX_CHARS);
  if (!text) return new Response('missing text', { status: 400 });
  const speakerParam = Number(url.searchParams.get('speaker'));
  const speaker =
    Number.isFinite(speakerParam) && speakerParam > 0 ? speakerParam : DEFAULT_SPEAKER;
  // Playback speed (VOICEVOX `speedScale` — a true time-stretch that KEEPS pitch, unlike the browser's
  // audio.playbackRate). Clamp to the same 0.5–2 range the UI offers; 1 = untouched. NB: an ABSENT
  // `rate` param → get() is null → Number(null) is 0 (and Number.isFinite(0) is true), so we must guard
  // on `> 0`, else a plain play (no rate) would wrongly synthesize at speedScale 0.5 (half speed).
  const rateRaw = url.searchParams.get('rate');
  const rateNum = rateRaw != null ? Number(rateRaw) : NaN;
  const rate = Number.isFinite(rateNum) && rateNum > 0 ? Math.min(2, Math.max(0.5, rateNum)) : 1;

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    // VOICEVOX is a two-step API: build the prosody query, then synthesize it to WAV. Note `text` and
    // `speaker` are QUERY params on the POST (a VOICEVOX quirk), not a JSON body.
    const queryRes = await fetch(
      `${ENGINE}/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`,
      { method: 'POST', signal },
    );
    if (!queryRes.ok) return new Response('tts query failed', { status: 503 });
    // Pass the prosody query straight through unless a non-default speed is requested — then splice
    // `speedScale` into the JSON so the engine stretches time without shifting pitch.
    let query = await queryRes.text();
    if (rate !== 1) {
      try {
        const parsed = JSON.parse(query) as { speedScale?: number };
        parsed.speedScale = rate;
        query = JSON.stringify(parsed);
      } catch {
        // malformed query JSON → fall back to the untouched query (natural speed) rather than 500
      }
    }

    const synthRes = await fetch(`${ENGINE}/synthesis?speaker=${speaker}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: query,
      signal,
    });
    if (!synthRes.ok) return new Response('tts synthesis failed', { status: 503 });

    // BUFFERED, not streamed (`synthRes.body`), and RANGE-AWARE — this is what makes playback work on
    // iOS. Mobile Safari does not just GET a media URL: it first probes with `Range: bytes=0-1` and
    // expects `206 Partial Content` + `Content-Range`, and it wants a real `Content-Length`. Streaming
    // the upstream body produced `200` + `Transfer-Encoding: chunked` for that probe, so Safari decided
    // the resource was not seekable media and refused to play it — silently. Desktop Chrome/Firefox
    // never cared, which is exactly why this looked like "audio works everywhere except my phone".
    // A reference sentence is ~45KB of WAV, so buffering it costs nothing and we need the length anyway.
    const audio = new Uint8Array(await synthRes.arrayBuffer());
    const base: Record<string, string> = {
      'content-type': 'audio/wav',
      'accept-ranges': 'bytes',
      // Same text → same audio; let the browser cache so replaying a card costs nothing.
      'cache-control': 'public, max-age=86400',
    };

    const range = req.headers.get('range');
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Math.min(Number(m[2]), audio.length - 1) : audio.length - 1;
        if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < audio.length) {
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
        // Unsatisfiable range → 416 with the true size, per RFC 9110. Safari recovers by re-requesting.
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
    // Engine down / not started / timed out → tell the client to fall back to Web Speech.
    return new Response('tts unavailable', { status: 503 });
  }
}
