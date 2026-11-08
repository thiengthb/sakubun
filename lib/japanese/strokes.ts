// The stroke grader of kanji handwriting (KJ4, docs/plans/2026-11-08-kanji.md › Máy chấm nét): each
// stroke the learner draws is compared with the KanjiVG stroke of the same order, the way Hanzi
// Writer does it but on KanjiVG's Japanese stroke order. Pure: points in, verdicts out. Every point is
// in KanjiVG's 109 × 109 box; the canvas scales the pointer into it.

export interface Point {
  x: number;
  y: number;
}

/** KanjiVG's drawing box. */
export const STROKE_BOX = 109;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/**
 * The points along one KanjiVG stroke. Its path data uses only M, C, c, S and s (moves and cubic
 * Béziers); each curve is cut into `perCurve` straight pieces.
 */
export function pathPoints(d: string, perCurve = 8): Point[] {
  const tokens = d.match(/[MmCcSs]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const points: Point[] = [];
  let at: Point = { x: 0, y: 0 };
  let lastControl: Point | null = null;
  let cmd = '';
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const pt = (): Point => {
      const x = num();
      const y = num();
      return rel ? { x: at.x + x, y: at.y + y } : { x, y };
    };
    if (cmd === 'M' || cmd === 'm') {
      at = pt();
      points.push(at);
      lastControl = null;
      // Pairs after a move are line-tos in SVG; KanjiVG never writes them, so treat them as curves.
      cmd = rel ? 'c' : 'C';
      continue;
    }
    let c1: Point;
    if (cmd === 'S' || cmd === 's') {
      c1 = lastControl ? { x: 2 * at.x - lastControl.x, y: 2 * at.y - lastControl.y } : at;
    } else {
      c1 = pt();
    }
    const c2 = pt();
    const end = pt();
    for (let k = 1; k <= perCurve; k++) points.push(cubic(at, c1, c2, end, k / perCurve));
    lastControl = c2;
    at = end;
  }
  return points;
}

export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let k = 1; k < points.length; k++) total += dist(points[k - 1], points[k]);
  return total;
}

/** `n` points spread evenly along the line, the first and last kept. */
export function resample(points: readonly Point[], n: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1 || n < 2) return Array.from({ length: Math.max(n, 1) }, () => points[0]);
  const total = pathLength(points);
  if (total === 0) return Array.from({ length: n }, () => points[0]);
  const step = total / (n - 1);
  const out: Point[] = [points[0]];
  let walked = 0;
  let k = 1;
  let from = points[0];
  for (let j = 1; j < n - 1; j++) {
    const want = j * step;
    while (k < points.length) {
      const seg = dist(from, points[k]);
      if (walked + seg >= want) {
        const t = seg === 0 ? 0 : (want - walked) / seg;
        from = { x: from.x + (points[k].x - from.x) * t, y: from.y + (points[k].y - from.y) * t };
        walked = want;
        break;
      }
      walked += seg;
      from = points[k];
      k++;
    }
    out.push(from);
  }
  out.push(points[points.length - 1]);
  return out;
}

const SAMPLES = 24;

function meanDistance(a: readonly Point[], b: readonly Point[]): number {
  let total = 0;
  for (let k = 0; k < a.length; k++) total += dist(a[k], b[k]);
  return total / a.length;
}

export type StrokeVerdict =
  { ok: true } | { ok: false; why: 'too-short' | 'far' | 'reversed' | 'shape' | 'order' };

/**
 * Whether a drawn stroke is the expected one: it starts and ends near the stroke's ends, runs the
 * same way, and keeps close to it on average. A dot (a short stroke) is judged by place alone.
 * `leniency` above 1 loosens every distance, for a hint already shown or a small screen.
 *
 * The distances alone are wide enough to let a neighbouring stroke through (書's parallel
 * horizontals, 主's dot and the bar under it), so with `rest`, the strokes still to come, a stroke
 * that lies closer to one of them than to the expected one is the wrong order.
 */
export function matchStroke(
  drawn: readonly Point[],
  expected: readonly Point[],
  { leniency = 1, rest = [] }: { leniency?: number; rest?: readonly (readonly Point[])[] } = {},
): StrokeVerdict {
  const drawnLength = pathLength(drawn);
  const expectedLength = pathLength(expected);
  if (drawn.length < 2 || drawnLength < 3) return { ok: false, why: 'too-short' };
  const a = resample(drawn, SAMPLES);
  const b = resample(expected, SAMPLES);
  const near = 22 * leniency;
  const mean = meanDistance(a, b);
  const backwards = meanDistance(a, [...b].reverse());
  const verdict = ((): StrokeVerdict => {
    if (expectedLength < 18) {
      const centre = (p: readonly Point[]) => p[Math.floor(p.length / 2)];
      return dist(centre(a), centre(b)) <= near ? { ok: true } : { ok: false, why: 'far' };
    }
    if (backwards + 4 < mean && backwards <= near) return { ok: false, why: 'reversed' };
    if (dist(a[0], b[0]) > near * 1.2 || dist(a.at(-1)!, b.at(-1)!) > near * 1.2)
      return { ok: false, why: 'far' };
    if (mean > near) return { ok: false, why: 'shape' };
    // A short stroke's drawn length is mostly the hand's wobble, so only a long one is held to it.
    const ratio = drawnLength / expectedLength;
    if (expectedLength >= 30 && (ratio < 0.35 || ratio > 2.5)) return { ok: false, why: 'shape' };
    return { ok: true };
  })();
  if (!verdict.ok) return verdict;
  const later = rest.some((r) => meanDistance(a, resample(r, SAMPLES)) < mean);
  return later ? { ok: false, why: 'order' } : verdict;
}

export type HandwritingRating = 1 | 2 | 3 | 4;

/**
 * The FSRS rating for a written kanji (the plan's table): Dễ for no mistake under 2 s a stroke, Nhớ
 * for no mistake, Khó for 1-2 mistakes without a hint, Quên for 3 or more, a hint, or giving up.
 */
export function rateHandwriting({
  mistakes,
  hinted,
  gaveUp,
  strokes,
  ms,
}: {
  mistakes: number;
  hinted: boolean;
  gaveUp: boolean;
  strokes: number;
  ms: number;
}): HandwritingRating {
  if (gaveUp || hinted || mistakes >= 3) return 1;
  if (mistakes > 0) return 2;
  return ms < 2000 * Math.max(strokes, 1) ? 4 : 3;
}
