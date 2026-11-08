import { Check } from 'lucide-react';
import { LIST_CARD } from '@/components/common/list-card';
import type { KanjiEntry } from '@/lib/kanji/catalog';
import { cn } from '@/lib/core/utils';

// A kanji as a square tile (KJ2, KJ5): the glyph over its [HÁN VIỆT]; a tick when the learner has
// its card. Pressing it opens the kanji's detail.

/** The tile grid: four across a phone, up to twelve on a wide laptop. */
export const KANJI_GRID =
  'grid grid-cols-4 gap-2 @md:grid-cols-6 @2xl:grid-cols-8 @4xl:grid-cols-10 @6xl:grid-cols-12';

export function KanjiTile({
  kanji: k,
  owned = false,
  onOpen,
}: {
  kanji: KanjiEntry;
  owned?: boolean;
  onOpen: () => void;
}) {
  return (
    <li data-slot="kanji-tile" data-owned={owned || undefined} className="flex">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          LIST_CARD.base,
          'relative flex aspect-square w-full min-w-0 flex-col items-center justify-center gap-1 p-1 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        {owned && <Check aria-hidden className="absolute top-1.5 right-1.5 size-4 text-ok" />}
        <span lang="ja" className="text-3xl leading-none">
          {k.kanji}
        </span>
        <span className="max-w-full truncate text-xs text-muted-foreground">[{k.hanviet}]</span>
        {owned && <span className="sr-only">, đã có</span>}
      </button>
    </li>
  );
}
