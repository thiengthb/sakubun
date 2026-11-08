import type { CSSProperties } from 'react';
import { cn } from '@/lib/core/utils';

// A kanji drawn from KanjiVG's strokes (KJ4), in a 109 × 109 box: still, or stroke by stroke in its
// order, so the back of a kanji card shows how it is written.
export function KanjiStrokes({
  paths,
  animate = false,
  label,
  className,
}: {
  paths: readonly string[];
  animate?: boolean;
  /** What a screen reader hears: the kanji itself. */
  label: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 109 109"
      role="img"
      aria-label={label}
      className={cn('text-foreground', className)}
      data-slot="kanji-strokes"
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animate ? 'kanji-stroke-draw' : undefined}
          style={animate ? ({ '--i': i } as CSSProperties) : undefined}
        />
      ))}
    </svg>
  );
}
