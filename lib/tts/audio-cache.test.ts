import { mkdtempSync, readdirSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { audioCache } from '@/lib/tts/audio-cache';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'sakubun-tts-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const bytes = (n: number, fill = 1) => new Uint8Array(n).fill(fill);

describe('audioCache', () => {
  it('returns what was put, and nothing for an unknown key', async () => {
    const cache = audioCache(path.join(tempDir(), 'nested'), 1000);
    expect(await cache.get('a')).toBeNull();
    await cache.put('a', bytes(10, 7));
    expect(await cache.get('a')).toEqual(bytes(10, 7));
  });

  it('drops the file played longest ago once the cache is over its size, and leaves no temp file', async () => {
    const dir = tempDir();
    const cache = audioCache(dir, 25);
    await cache.put('old', bytes(10));
    await cache.put('played', bytes(10));
    const longAgo = new Date(Date.now() - 60_000);
    utimesSync(path.join(dir, 'old.wav'), longAgo, longAgo);
    utimesSync(path.join(dir, 'played.wav'), longAgo, longAgo);
    expect(await cache.get('played')).not.toBeNull(); // a play makes it recent again

    await cache.put('new', bytes(10));
    expect(readdirSync(dir).sort()).toEqual(['new.wav', 'played.wav']);
  });

  it('is a no-op without a folder', async () => {
    const cache = audioCache(null, 1000);
    await cache.put('a', bytes(1));
    expect(await cache.get('a')).toBeNull();
  });
});
