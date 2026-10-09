import { parseFurigana } from '@/lib/japanese/furigana';
import { cn } from '@/lib/core/utils';

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
