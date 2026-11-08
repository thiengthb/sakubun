import { ttsTimingUrl } from '@/lib/japanese/tts-url';

// The browser's side of karaoke by the syllable (Kaiwa b): asks /api/tts once per sentence and voice
// when the mora starts, and remembers the answer for the page's life. Any failure is null, and the
// line keeps the even pace.
const asked = new Map<string, Promise<number[] | null>>();

export function loadMoraStarts(text: string, speaker?: number): Promise<number[] | null> {
  const url = ttsTimingUrl(text, speaker);
  let starts = asked.get(url);
  if (!starts) {
    starts = fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { starts?: unknown } | null) =>
        Array.isArray(body?.starts) && body.starts.every((s) => typeof s === 'number')
          ? (body.starts as number[])
          : null,
      )
      .catch(() => null);
    asked.set(url, starts);
  }
  return starts;
}
