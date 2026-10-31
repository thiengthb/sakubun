import { createHash } from 'node:crypto';

// The server's audio cache (K6a, docs/plans/2026-10-31-k6-kaiwa-listening.md): one WAV per
// (sentence, voice, speed), so a line VOICEVOX has read once plays at once the next time. Pure:
// naming and choosing what to drop; lib/tts/audio-cache.ts does the file I/O.

export interface TtsRequest {
  text: string;
  speaker: number;
  rate: number;
}

// The file name for one reading: a hash, so any sentence makes a safe, fixed-length name.
export function cacheKey({ text, speaker, rate }: TtsRequest): string {
  return createHash('sha256')
    .update(JSON.stringify([text, speaker, rate]))
    .digest('hex');
}

export interface CachedFile {
  name: string;
  size: number;
  /** When it was last written or played. */
  usedAt: number;
}

// The files to delete so the cache fits in maxBytes again: the ones played longest ago first.
export function filesToEvict(files: readonly CachedFile[], maxBytes: number): string[] {
  let total = files.reduce((n, f) => n + f.size, 0);
  if (total <= maxBytes) return [];
  const evict: string[] = [];
  for (const file of [...files].sort((a, b) => a.usedAt - b.usedAt || (a.name < b.name ? -1 : 1))) {
    if (total <= maxBytes) break;
    evict.push(file.name);
    total -= file.size;
  }
  return evict;
}

// Where the cache lives: TTS_CACHE_DIR, else a tts-cache folder beside the SQLite file (/data on
// the NUC, the volume that survives a deploy), else none.
export function cacheDir(env: Record<string, string | undefined>): string | null {
  if (env.TTS_CACHE_DIR) return env.TTS_CACHE_DIR;
  const url = env.DATABASE_URL;
  if (!url?.startsWith('file:/')) return null;
  const file = url.slice('file:'.length);
  return `${file.slice(0, file.lastIndexOf('/'))}/tts-cache`;
}
