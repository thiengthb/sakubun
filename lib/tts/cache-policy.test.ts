import { describe, expect, it } from 'vitest';
import { cacheDir, cacheKey, filesToEvict } from '@/lib/tts/cache-policy';

describe('cacheKey', () => {
  it('differs by sentence, voice and speed, and is the same for the same reading', () => {
    const base = { text: '来月のシフト？', speaker: 3, rate: 1 };
    const key = cacheKey(base);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(cacheKey({ ...base })).toBe(key);
    expect(cacheKey({ ...base, text: '来月のシフト' })).not.toBe(key);
    expect(cacheKey({ ...base, speaker: 13 })).not.toBe(key);
    expect(cacheKey({ ...base, rate: 0.6 })).not.toBe(key);
  });
});

describe('filesToEvict', () => {
  const files = [
    { name: 'new', size: 40, usedAt: 300 },
    { name: 'old', size: 50, usedAt: 100 },
    { name: 'mid', size: 30, usedAt: 200 },
  ];

  it('keeps everything while the total fits', () => {
    expect(filesToEvict(files, 120)).toEqual([]);
    expect(filesToEvict([], 0)).toEqual([]);
  });

  it('drops the files played longest ago until the rest fits', () => {
    expect(filesToEvict(files, 100)).toEqual(['old']);
    expect(filesToEvict(files, 60)).toEqual(['old', 'mid']);
    expect(filesToEvict(files, 0)).toEqual(['old', 'mid', 'new']);
  });
});

describe('cacheDir', () => {
  it('prefers TTS_CACHE_DIR, else sits beside an absolute SQLite file', () => {
    expect(cacheDir({ TTS_CACHE_DIR: '/tmp/x', DATABASE_URL: 'file:/data/sakubun.db' })).toBe(
      '/tmp/x',
    );
    expect(cacheDir({ DATABASE_URL: 'file:/data/sakubun.db' })).toBe('/data/tts-cache');
  });

  it('is off for a relative dev database or none', () => {
    expect(cacheDir({ DATABASE_URL: 'file:./dev.db' })).toBeNull();
    expect(cacheDir({})).toBeNull();
  });
});
