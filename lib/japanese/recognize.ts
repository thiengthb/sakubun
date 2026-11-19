// Kanji recognition for search by drawing (KD1, docs/plans/2026-11-19-kanji-draw-search.md, way A that
// thien picked on 19/11): the strokes the learner draws are compared with KanjiVG's strokes of every
// Jōyō kanji, and the closest few are offered. Unlike the grader in strokes.ts, nothing is known in
// advance, so every kanji with about as many strokes is scored and ranked. Pure: points in, kanji out.

import { pathPoints, resample, type Point } from './strokes';

/** Points kept along each stroke once it is resampled. */
const SAMPLES = 12;
/** How many strokes more or fewer than drawn a kanji may have and still be a candidate. */
export const STROKE_SLACK = 2;
/** The cost of a stroke left unmatched, in the same unit as a stroke's mean distance (box = 1). */
const SKIP_COST = 0.15;
/** Matching strokes regardless of order costs this much more than matching them in order. */
const UNORDERED_COST = 0.02;

/** A kanji's strokes, resampled and scaled into a unit box centred on 0. */
export interface KanjiShape {
  kanji: string;
  strokes: Point[][];
}

/**
 * Strokes resampled and scaled so their bounding box's longer side is 1, centred on 0: how big and
 * where on the pad the learner drew does not matter, the shape does.
 */
export function normalizeStrokes(strokes: readonly (readonly Point[])[]): Point[][] {
  const all = strokes.flat();
  if (all.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of all) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  // A tap alone has no extent; anything else is scaled by its own, however small the pad's units.
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return strokes.map((s) =>
    resample(s, SAMPLES).map((p) => ({ x: (p.x - cx) / size, y: (p.y - cy) / size })),
  );
}

/** Every kanji of KanjiVG's table, ready to compare. Built once per process. */
export function prepareShapes(table: Readonly<Record<string, readonly string[]>>): KanjiShape[] {
  return Object.entries(table).map(([kanji, paths]) => ({
    kanji,
    strokes: normalizeStrokes(paths.map((d) => pathPoints(d))),
  }));
}

const meanDistance = (a: readonly Point[], b: readonly Point[]) => {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return total / a.length;
};

// In order, except that two neighbouring strokes may be written the other way round, each such
// swap costing UNORDERED_COST: the commonest slip (口's last two strokes, 書's bars).
function inOrder(drawn: readonly Point[][], shape: readonly Point[][]): number {
  const n = drawn.length;
  const best = Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    best[i] = best[i - 1] + meanDistance(drawn[i - 1], shape[i - 1]);
    if (i >= 2) {
      const swapped =
        best[i - 2] +
        meanDistance(drawn[i - 2], shape[i - 1]) +
        meanDistance(drawn[i - 1], shape[i - 2]) +
        UNORDERED_COST;
      if (swapped < best[i]) best[i] = swapped;
    }
  }
  return best[n] / n;
}

// Learners often swap two strokes; each drawn stroke takes the nearest stroke still free.
function anyOrder(drawn: readonly Point[][], shape: readonly Point[][]): number {
  const pairs: [number, number, number][] = [];
  drawn.forEach((s, i) => shape.forEach((t, j) => pairs.push([meanDistance(s, t), i, j])));
  pairs.sort((a, b) => a[0] - b[0]);
  const usedDrawn = new Set<number>();
  const usedShape = new Set<number>();
  let total = 0;
  for (const [d, i, j] of pairs) {
    if (usedDrawn.has(i) || usedShape.has(j)) continue;
    usedDrawn.add(i);
    usedShape.add(j);
    total += d;
  }
  return total / drawn.length + UNORDERED_COST;
}

// A stroke too many or too few: the shorter list is matched in order into the longer one, and each
// stroke of the longer one left over costs SKIP_COST.
function withSkips(drawn: readonly Point[][], shape: readonly Point[][]): number {
  const [short, long] = drawn.length < shape.length ? [drawn, shape] : [shape, drawn];
  const n = short.length;
  const m = long.length;
  let row = Array.from({ length: m + 1 }, (_, j) => j * SKIP_COST);
  for (let i = 1; i <= n; i++) {
    const next = Array<number>(m + 1).fill(Infinity);
    for (let j = i; j <= m; j++) {
      next[j] = Math.min(
        next[j - 1] + SKIP_COST,
        row[j - 1] + meanDistance(short[i - 1], long[j - 1]),
      );
    }
    row = next;
  }
  return row[m] / m;
}

/** How far the drawing is from a kanji: 0 is the same shape, lower is closer. */
export function shapeDistance(drawn: readonly Point[][], shape: readonly Point[][]): number {
  if (Math.abs(drawn.length - shape.length) > STROKE_SLACK) return Infinity;
  if (drawn.length === shape.length) return Math.min(inOrder(drawn, shape), anyOrder(drawn, shape));
  return withSkips(drawn, shape);
}

/**
 * The kanji closest to what was drawn, closest first. `strokes` are in any box (the pad's own);
 * a stroke of one point (a tap) still counts, since a dot is a stroke.
 */
export function recognizeKanji(
  strokes: readonly (readonly Point[])[],
  shapes: readonly KanjiShape[],
  take = 10,
): string[] {
  const drawn = normalizeStrokes(strokes.filter((s) => s.length > 0));
  if (drawn.length === 0) return [];
  return shapes
    .map((s) => ({ kanji: s.kanji, d: shapeDistance(drawn, s.strokes) }))
    .filter((s) => Number.isFinite(s.d))
    .sort((a, b) => a.d - b.d)
    .slice(0, take)
    .map((s) => s.kanji);
}
