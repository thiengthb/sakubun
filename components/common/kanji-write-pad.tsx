'use client';

import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { matchStroke, pathPoints, STROKE_BOX, type Point } from '@/lib/japanese/strokes';
import { cn } from '@/lib/core/utils';

// The writing pad of a kanji card (KJ4, docs/plans/2026-11-08-kanji.md › Máy chấm nét): the learner
// draws stroke by stroke; each stroke is checked against KanjiVG's stroke of the same order. A right
// stroke is replaced by the clean one, a wrong one flashes and is drawn again; after two misses on
// one stroke its outline shows as a hint. "Không nhớ" gives up.

export interface Written {
  mistakes: number;
  hinted: boolean;
  gaveUp: boolean;
  /** From the first touch to the last stroke. */
  ms: number;
}

const MISSES_BEFORE_HINT = 2;

export function KanjiWritePad({
  paths,
  onDone,
}: {
  paths: readonly string[];
  onDone: (written: Written) => void;
}) {
  const expected = useMemo(() => paths.map((d) => pathPoints(d)), [paths]);
  const [done, setDone] = useState(0);
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  // The pointer drawing the current stroke; a second finger or another button is ignored.
  const pointer = useRef<number | null>(null);
  const [miss, setMiss] = useState<Point[] | null>(null);
  const [misses, setMisses] = useState(0);
  const tally = useRef({ mistakes: 0, hinted: false, startedAt: 0 });
  const box = useRef<SVGSVGElement>(null);
  const finished = done >= paths.length;
  const showHint = !finished && misses >= MISSES_BEFORE_HINT;

  const toBox = (e: PointerEvent<SVGSVGElement>): Point => {
    const rect = box.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * STROKE_BOX,
      y: ((e.clientY - rect.top) / rect.height) * STROKE_BOX,
    };
  };

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (finished || pointer.current !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tally.current.startedAt === 0) tally.current.startedAt = performance.now();
    setMiss(null);
    setDrawing([toBox(e)]);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!drawing || e.pointerId !== pointer.current) return;
    setDrawing([...drawing, toBox(e)]);
  };
  const up = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointer.current) return;
    pointer.current = null;
    if (!drawing) return;
    const stroke = drawing;
    setDrawing(null);
    if (stroke.length < 2) return;
    const verdict = matchStroke(stroke, expected[done], {
      leniency: showHint ? 1.4 : 1,
      rest: expected.slice(done + 1),
    });
    if (verdict.ok) {
      const next = done + 1;
      setDone(next);
      setMisses(0);
      if (next >= paths.length)
        onDone({
          mistakes: tally.current.mistakes,
          hinted: tally.current.hinted,
          gaveUp: false,
          ms: performance.now() - tally.current.startedAt,
        });
      return;
    }
    tally.current.mistakes++;
    if (misses + 1 >= MISSES_BEFORE_HINT) tally.current.hinted = true;
    setMisses(misses + 1);
    setMiss(stroke);
  };

  const line = (points: readonly Point[]) => points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        ref={box}
        viewBox="0 0 109 109"
        role="img"
        aria-label="Khung viết: viết chữ theo đúng thứ tự nét"
        data-slot="kanji-pad"
        data-done={done}
        className={cn(
          'aspect-square w-full max-w-72 touch-none rounded-xl border-2 border-border bg-card select-none',
          !finished && 'cursor-crosshair',
        )}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={(e) => {
          if (e.pointerId !== pointer.current) return;
          pointer.current = null;
          setDrawing(null);
        }}
      >
        <g className="text-border" stroke="currentColor" strokeWidth={0.6} strokeDasharray="2 2">
          <line x1={54.5} y1={0} x2={54.5} y2={109} />
          <line x1={0} y1={54.5} x2={109} y2={54.5} />
        </g>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {showHint && (
            <path
              d={paths[done]}
              pathLength={1}
              stroke="currentColor"
              strokeWidth={4}
              className="kanji-stroke-draw text-muted-foreground/40"
              data-slot="kanji-hint"
            />
          )}
          {paths.slice(0, done).map((d, i) => (
            <path key={i} d={d} stroke="currentColor" strokeWidth={4} className="text-foreground" />
          ))}
          {miss && (
            <polyline
              points={line(miss)}
              stroke="currentColor"
              strokeWidth={4}
              className="text-destructive"
            />
          )}
          {drawing && (
            <polyline
              points={line(drawing)}
              stroke="currentColor"
              strokeWidth={4}
              className="text-accent-brand"
            />
          )}
        </g>
      </svg>
      <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {finished
          ? 'Viết xong'
          : miss
            ? `Nét ${done + 1} chưa đúng, viết lại${showHint ? ' theo nét gợi ý' : ''}`
            : `Nét ${done + 1} / ${paths.length}`}
      </p>
      {!finished && (
        <Button
          variant="outline"
          onClick={() =>
            onDone({
              mistakes: tally.current.mistakes,
              hinted: tally.current.hinted,
              gaveUp: true,
              ms: 0,
            })
          }
        >
          Không nhớ
        </Button>
      )}
    </div>
  );
}
