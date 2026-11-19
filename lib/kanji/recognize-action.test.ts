import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { pathPoints } from '@/lib/japanese/strokes';

// KD1: the action behind the drawing pad. It answers a signed-in learner's strokes with kanji, and
// turns away what is not a drawing with one line to read.

vi.mock('@/lib/auth/current-user', () => ({ getSessionUserId: async () => 'learner' }));

const { recognizeKanjiAction } = await import('@/app/resources/actions');

const STROKES: Record<string, string[]> = JSON.parse(
  readFileSync('data/kanji/strokes.json', 'utf8'),
);

describe('recognizeKanjiAction', () => {
  it('answers strokes sent as [x, y] pairs', async () => {
    const drawn = STROKES['会'].map((d) => pathPoints(d).map((p) => [p.x * 3, p.y * 3]));
    const r = await recognizeKanjiAction(drawn);
    expect(r.ok && r.data[0]).toBe('会');
  });

  it('turns away what is not a drawing', async () => {
    for (const bad of [
      null,
      [],
      [[]],
      [[[1]]],
      [[[1, Number.NaN]]],
      'x',
      Array(40).fill([[1, 2]]),
    ]) {
      const r = await recognizeKanjiAction(bad);
      expect(r).toEqual({ ok: false, error: 'Nét vẽ không đọc được. Xoá hết rồi vẽ lại.' });
    }
  });
});
