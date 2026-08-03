import { parseFurigana } from '@/lib/furigana';
import { cn } from '@/lib/utils';

/**
 * Renders `漢字[かな]`-annotated Japanese with furigana <ruby> that stays HIDDEN until the sentence is
 * hovered (a reading hint, not a spoiler) — see `.furigana` in globals.css. Touch devices (no hover)
 * show it always. Pure presentational; the reading segmentation comes from Claude via parseFurigana.
 */
export function FuriganaText({ ruby, className }: { ruby: string; className?: string }) {
  const segments = parseFurigana(ruby);
  return (
    <span lang="ja" className={cn('furigana', className)}>
      {segments.map((s, i) =>
        s.reading ? (
          <ruby key={i}>
            {s.text}
            <rt>{s.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}
