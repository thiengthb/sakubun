'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { Keyboard, Trash2, Undo2 } from 'lucide-react';
import { recognizeKanjiAction } from '@/app/resources/actions';
import { Button } from '@/components/ui/button';
import { resample, STROKE_BOX, type Point } from '@/lib/japanese/strokes';
import { cn } from '@/lib/core/utils';

// Search by drawing (KD2, docs/plans/2026-11-19-kanji-draw-search.md: layout B, then round 2's C that
// thien picked on 19/11): the learner draws one kanji, the server guesses it after every stroke (KD1),
// and a tap on a guess hands it on and clears the pad for the next one. The tools are icons alone in a
// column beside the pad, so the pad is as big as it gets (thien: those icons need no words).

/** Points sent per stroke: enough for the shape, few enough for a small request. */
const SENT_POINTS = 48;

export function KanjiDrawPad({
  onPick,
  onKeyboard,
}: {
  onPick: (kanji: string) => void;
  /** The phone's way back to typing. */
  onKeyboard?: () => void;
}) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const pointer = useRef<number | null>(null);
  // The stroke being drawn, read by the handlers: a quick tap can lift before the pad re-renders.
  const current = useRef<Point[] | null>(null);
  const box = useRef<SVGSVGElement>(null);
  // Only the answer to the latest drawing counts; an earlier one landing late is dropped.
  const asked = useRef(0);

  const guess = async (next: Point[][]) => {
    const n = ++asked.current;
    if (next.length === 0) {
      setGuesses([]);
      setFailed(false);
      return;
    }
    const sent = next.map((s) =>
      resample(s, Math.min(s.length, SENT_POINTS)).map((p) => [p.x, p.y] as [number, number]),
    );
    const r = await recognizeKanjiAction(sent).catch(() => null);
    if (n !== asked.current) return;
    setFailed(!r?.ok);
    setGuesses(r?.ok ? r.data : []);
  };

  // The strokes so far, for handlers that may run twice before a re-render.
  const done = useRef<Point[][]>([]);
  const update = (next: Point[][]) => {
    done.current = next;
    setStrokes(next);
    void guess(next);
  };

  const toBox = (e: PointerEvent<SVGSVGElement>): Point => {
    const rect = box.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * STROKE_BOX,
      y: ((e.clientY - rect.top) / rect.height) * STROKE_BOX,
    };
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = [toBox(e)];
    setDrawing(current.current);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!current.current || e.pointerId !== pointer.current) return;
    current.current = [...current.current, toBox(e)];
    setDrawing(current.current);
  };
  const up = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointer.current) return;
    pointer.current = null;
    const stroke = current.current;
    current.current = null;
    if (stroke) update([...done.current, stroke]);
    setDrawing(null);
  };

  const pick = (kanji: string) => {
    onPick(kanji);
    update([]);
  };

  const line = (points: readonly Point[]) =>
    points.length === 1
      ? `${points[0].x},${points[0].y} ${points[0].x + 0.1},${points[0].y}`
      : points.map((p) => `${p.x},${p.y}`).join(' ');

  // Icons alone, in a column beside the pad (thien picked C on 19/11: the pad as big as it gets while
  // a phone still shows results above it; the icons need no words, thien said).
  const tools = (
    <>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Xoá nét"
        title="Xoá nét"
        disabled={strokes.length === 0}
        onClick={() => update(strokes.slice(0, -1))}
      >
        <Undo2 />
      </Button>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Xoá hết"
        title="Xoá hết"
        disabled={strokes.length === 0}
        onClick={() => update([])}
      >
        <Trash2 />
      </Button>
      {onKeyboard && (
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Bàn phím"
          title="Bàn phím"
          onClick={onKeyboard}
        >
          <Keyboard />
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-3" data-slot="kanji-draw-pad">
      <div aria-live="polite" className="flex min-h-9 gap-1.5 overflow-x-auto">
        {guesses.map((k, i) => (
          <Button
            key={k}
            variant={i === 0 ? 'secondary' : 'outline'}
            size="icon-lg"
            aria-label={`Thêm ${k}`}
            onClick={() => pick(k)}
            className="shrink-0"
          >
            <span lang="ja" className="text-xl">
              {k}
            </span>
          </Button>
        ))}
        {guesses.length === 0 && (
          <p className="self-center text-sm text-muted-foreground">
            {failed
              ? 'Chưa đoán được. Xoá hết rồi vẽ lại.'
              : 'Vẽ một chữ kanji, rồi bấm chữ đúng để thêm vào ô tìm.'}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <svg
          ref={box}
          viewBox="0 0 109 109"
          role="img"
          aria-label="Khung vẽ chữ kanji"
          data-slot="kanji-draw"
          data-strokes={strokes.length}
          className={cn(
            'aspect-square cursor-crosshair touch-none rounded-xl border-2 border-border bg-card select-none',
            'min-w-0 flex-1',
          )}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={(e) => {
            if (e.pointerId !== pointer.current) return;
            pointer.current = null;
            current.current = null;
            setDrawing(null);
          }}
        >
          <g className="text-border" stroke="currentColor" strokeWidth={0.6} strokeDasharray="2 2">
            <line x1={54.5} y1={0} x2={54.5} y2={109} />
            <line x1={0} y1={54.5} x2={109} y2={54.5} />
          </g>
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {strokes.map((s, i) => (
              <polyline key={i} points={line(s)} className="text-foreground" />
            ))}
            {drawing && <polyline points={line(drawing)} className="text-accent-brand" />}
          </g>
        </svg>
        <div className="flex flex-col gap-2">{tools}</div>
      </div>
    </div>
  );
}
