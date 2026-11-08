import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  matchStroke,
  pathLength,
  pathPoints,
  rateHandwriting,
  resample,
  type Point,
} from '@/lib/japanese/strokes';

const STROKES: Record<string, string[]> = JSON.parse(
  readFileSync('data/kanji/strokes.json', 'utf8'),
);
const stroke = (kanji: string, n: number) => pathPoints(STROKES[kanji][n]);
const shift = (points: Point[], dx: number, dy: number) =>
  points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
// A hand-drawn copy: fewer points, and a little wobble.
const byHand = (points: Point[]) =>
  resample(points, 12).map((p, i) => ({
    x: p.x + (i % 2 ? 2 : -2),
    y: p.y + (i % 3 ? 1.5 : -1.5),
  }));

describe('pathPoints', () => {
  it('follows a KanjiVG stroke from its first point to its last', () => {
    const one = stroke('一', 0);
    expect(one[0]).toEqual({ x: 11, y: 54.25 });
    expect(one.at(-1)!.x).toBeGreaterThan(95);
    expect(pathLength(one)).toBeGreaterThan(80);
  });

  it('reads absolute curves and smooth curves (口)', () => {
    const [left, top] = [stroke('口', 0), stroke('口', 1)];
    expect(left.at(-1)).toEqual({ x: 30, y: 83 });
    expect(top[0]).toEqual({ x: 25.29, y: 35.67 });
    expect(Math.max(...top.map((p) => p.x))).toBeGreaterThan(80);
  });
});

describe('resample', () => {
  it('spreads points evenly and keeps both ends', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 30, y: 0 },
    ];
    expect(resample(line, 4).map((p) => Math.round(p.x))).toEqual([0, 10, 20, 30]);
  });
});

describe('matchStroke', () => {
  it('takes every stroke of 経 drawn by hand in order', () => {
    STROKES['経'].forEach((_, n) => {
      expect(matchStroke(byHand(stroke('経', n)), stroke('経', n))).toEqual({ ok: true });
    });
  });

  it('refuses a stroke drawn backwards', () => {
    expect(matchStroke([...stroke('一', 0)].reverse(), stroke('一', 0))).toEqual({
      ok: false,
      why: 'reversed',
    });
  });

  it('refuses a stroke in the wrong place, another stroke, or a tap', () => {
    expect(matchStroke(shift(stroke('一', 0), 0, 35), stroke('一', 0)).ok).toBe(false);
    // 口's second stroke (the top and right side) where the first (the left side) is due.
    expect(matchStroke(stroke('口', 1), stroke('口', 0)).ok).toBe(false);
    expect(matchStroke([{ x: 50, y: 50 }], stroke('一', 0))).toEqual({
      ok: false,
      why: 'too-short',
    });
  });

  it('judges a dot by where it is', () => {
    const dot = stroke('経', 2); // 糸's small tick
    expect(matchStroke(byHand(dot), dot).ok).toBe(true);
    expect(matchStroke(shift(byHand(dot), 50, 40), dot).ok).toBe(false);
  });

  it('lets a wider leniency take a sloppier stroke', () => {
    const sloppy = shift(stroke('一', 0), 0, 24);
    expect(matchStroke(sloppy, stroke('一', 0)).ok).toBe(false);
    expect(matchStroke(sloppy, stroke('一', 0), 1.5).ok).toBe(true);
  });
});

describe('rateHandwriting', () => {
  const base = { mistakes: 0, hinted: false, gaveUp: false, strokes: 11 };
  it('follows the plan: Dễ, Nhớ, Khó, Quên', () => {
    expect(rateHandwriting({ ...base, ms: 15_000 })).toBe(4);
    expect(rateHandwriting({ ...base, ms: 30_000 })).toBe(3);
    expect(rateHandwriting({ ...base, mistakes: 2, ms: 10_000 })).toBe(2);
    expect(rateHandwriting({ ...base, mistakes: 3, ms: 10_000 })).toBe(1);
    expect(rateHandwriting({ ...base, hinted: true, ms: 10_000 })).toBe(1);
    expect(rateHandwriting({ ...base, gaveUp: true, ms: 1_000 })).toBe(1);
  });
});
