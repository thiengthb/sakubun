import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { filesToEvict, type CachedFile } from '@/lib/tts/cache-policy';

// The WAV files /api/tts keeps (K6a). A cache never breaks speech: any file error is a miss, and
// a failed write only means the next play asks VOICEVOX again.

export interface AudioCache {
  get(key: string): Promise<Uint8Array<ArrayBuffer> | null>;
  put(key: string, audio: Uint8Array): Promise<void>;
}

const NO_CACHE: AudioCache = { get: async () => null, put: async () => {} };

// A temp file this old was left by a write that died midway (the process stopped); prune drops it.
const STALE_TEMP_MS = 10 * 60_000;

export function audioCache(dir: string | null, maxBytes: number): AudioCache {
  if (!dir) return NO_CACHE;
  const file = (key: string) => path.join(dir, `${key}.wav`);

  async function prune(): Promise<void> {
    const files: CachedFile[] = [];
    for (const name of await readdir(dir!)) {
      const info = await stat(path.join(dir!, name)).catch(() => null);
      if (!info) continue;
      if (name.endsWith('.wav')) files.push({ name, size: info.size, usedAt: info.mtimeMs });
      else if (name.endsWith('.tmp') && Date.now() - info.mtimeMs > STALE_TEMP_MS) {
        await unlink(path.join(dir!, name)).catch(() => {});
      }
    }
    for (const name of filesToEvict(files, maxBytes)) {
      await unlink(path.join(dir!, name)).catch(() => {});
    }
  }

  return {
    async get(key) {
      try {
        const audio = await readFile(file(key));
        // Played now: the mtime is the "last used" that pruning reads (atime is often off).
        const now = new Date();
        await utimes(file(key), now, now).catch(() => {});
        return new Uint8Array(audio);
      } catch {
        return null;
      }
    },
    async put(key, audio) {
      // Written whole under another name first, so a play never reads half a file.
      const temp = path.join(dir, `${key}.${randomUUID()}.tmp`);
      try {
        await mkdir(dir, { recursive: true });
        await writeFile(temp, audio);
        await rename(temp, file(key));
        await prune();
      } catch (error) {
        await unlink(temp).catch(() => {});
        console.warn('[tts] audio cache write failed', error);
      }
    },
  };
}
