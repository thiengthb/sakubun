import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pathPoints, type Point } from './strokes';
import { prepareShapes, recognizeKanji, shapeDistance, normalizeStrokes } from './recognize';

// KD1: the drawing is made from KanjiVG's own strokes, bent the way a hand bends them (scaled,
// turned, each stroke moved, every point shaken). A fixed seed keeps the numbers the same each run;
// the floors below sit a little under what this seed gives (2026-11-19-kanji-draw-search.md).

const table = JSON.parse(
  readFileSync(path.join(process.cwd(), 'data/kanji/strokes.json'), 'utf8'),
) as Record<string, string[]>;
const shapes = prepareShapes(table);
const kanji = Object.keys(table);

function random(seed: number) {
  let s = seed;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const wobble = () => (next() + next() + next() - 1.5) * 1.4;
  return { next, wobble };
}

interface Mess {
  level: number;
  swap?: boolean;
  drop?: boolean;
}

function drawLike(
  paths: readonly string[],
  { level, swap, drop }: Mess,
  r: ReturnType<typeof random>,
) {
  const scale = 0.8 + r.next() * 0.4;
  const scaleY = scale * (0.9 + r.next() * 0.2);
  const turn = r.wobble() * 0.05 * level;
  const dx = r.wobble() * 10;
  const dy = r.wobble() * 10;
  const strokes: Point[][] = paths.map((d) => {
    const ox = r.wobble() * 4 * level;
    const oy = r.wobble() * 4 * level;
    const grow = 1 + r.wobble() * 0.1 * level;
    return pathPoints(d).map((p) => {
      const x = (p.x - 54) * grow;
      const y = (p.y - 54) * grow;
      const tx = x * Math.cos(turn) - y * Math.sin(turn);
      const ty = x * Math.sin(turn) + y * Math.cos(turn);
      return {
        x: tx * scale + 54 + dx + ox + r.wobble() * 1.5 * level,
        y: ty * scaleY + 54 + dy + oy + r.wobble() * 1.5 * level,
      };
    });
  });
  if (swap && strokes.length > 3) {
    const i = Math.floor(r.next() * (strokes.length - 1));
    [strokes[i], strokes[i + 1]] = [strokes[i + 1], strokes[i]];
  }
  if (drop && strokes.length > 3) strokes.splice(Math.floor(r.next() * strokes.length), 1);
  return strokes;
}

/** Share of a fixed sample whose kanji comes within the first `within` guesses. */
function hitRate(mess: Mess, within: number, count = 60): number {
  const r = random(7 + mess.level * 31 + (mess.swap ? 1 : 0) + (mess.drop ? 2 : 0));
  let hits = 0;
  for (let n = 0; n < count; n++) {
    const k = kanji[Math.floor(r.next() * kanji.length)];
    const guesses = recognizeKanji(drawLike(table[k], mess, r), shapes, within);
    if (guesses.includes(k)) hits++;
  }
  return hits / count;
}

describe('recognizeKanji (KD1)', () => {
  it('knows every kanji drawn exactly as KanjiVG has it, at any size and place', () => {
    for (const k of ['一', '会', '書', '日', '目', '鬱']) {
      const moved = table[k].map((d) =>
        pathPoints(d).map((p) => ({ x: p.x * 2.5 + 40, y: p.y * 2.5 + 10 })),
      );
      expect(recognizeKanji(moved, shapes)[0]).toBe(k);
      // A pad that counts in fractions of its box draws the same kanji.
      const tiny = table[k].map((d) => pathPoints(d).map((p) => ({ x: p.x / 109, y: p.y / 109 })));
      expect(recognizeKanji(tiny, shapes)[0]).toBe(k);
    }
  });

  it('finds a hand-drawn kanji among the first five', { timeout: 60_000 }, () => {
    expect(hitRate({ level: 1 }, 1)).toBeGreaterThanOrEqual(0.95);
    expect(hitRate({ level: 2 }, 5)).toBeGreaterThanOrEqual(0.93);
    expect(hitRate({ level: 3 }, 10)).toBeGreaterThanOrEqual(0.8);
  });

  it('copes with two strokes swapped or one left out', { timeout: 60_000 }, () => {
    expect(hitRate({ level: 2, swap: true }, 5)).toBeGreaterThanOrEqual(0.92);
    expect(hitRate({ level: 2, drop: true }, 5)).toBeGreaterThanOrEqual(0.9);
  });

  it('offers nothing for nothing, and skips kanji far off in stroke count', () => {
    expect(recognizeKanji([], shapes)).toEqual([]);
    expect(recognizeKanji([[]], shapes)).toEqual([]);
    const one = normalizeStrokes([
      [
        { x: 10, y: 50 },
        { x: 90, y: 50 },
      ],
    ]);
    const many = normalizeStrokes(table['鬱'].map((d) => pathPoints(d)));
    expect(shapeDistance(one, many)).toBe(Infinity);
  });

  it('counts a tap as a stroke (a dot)', () => {
    const tap = [{ x: 50, y: 20 }];
    const line = [
      { x: 10, y: 50 },
      { x: 90, y: 50 },
    ];
    expect(normalizeStrokes([tap, line])).toHaveLength(2);
    // A dot over a line: every guess has one to four strokes.
    for (const k of recognizeKanji([tap, line], shapes))
      expect(table[k].length).toBeLessThanOrEqual(4);
  });
});
