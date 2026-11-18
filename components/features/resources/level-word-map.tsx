'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WORD_STATES } from '@/lib/library/level-sets';
import { STATE_LABEL } from '@/lib/library/level-screen';
import { activeFilter, type MapFilter } from '@/lib/library/level-views';
import { firstOpenWord, type WordCard } from '@/lib/library/set-screen';
import { cn } from '@/lib/core/utils';
import { WordMap, type MapSection } from './word-map';
import { MARK } from './word-marks';

// The level screen's "Bản đồ ô" (U4c4, docs/plans/2026-11-14-u4-kho.md, sketch u4c-r2/b.jpg): a
// tile per word of the whole level, cut by set, with the legend as a filter.

export function LevelWordMap({
  words,
  speaker,
  rate,
}: {
  words: WordCard[];
  speaker?: number;
  rate?: number;
}) {
  const [only, setOnly] = useState<MapFilter>('all');
  const counts = WORD_STATES.map((s) => [s, words.filter((w) => w.state === s).length] as const);
  const active = activeFilter(only, words);
  const shown = active === 'all' ? words : words.filter((w) => w.state === active);
  const sections: MapSection[] = [];
  for (const w of shown) {
    const last = sections.at(-1);
    if (last && last.words[0]!.set.number === w.set.number) last.words.push(w);
    else
      sections.push({
        key: `chang-${w.set.number}`,
        label: `Chặng ${w.set.number}`,
        title: (
          <Link href={w.set.href} className="hover:underline">
            Chặng {w.set.number}
          </Link>
        ),
        words: [w],
      });
  }
  // A filter that hides the open word opens the first word it keeps (WordMap is keyed by filter).
  const first = shown[firstOpenWord(shown)];
  if (words.length === 0)
    return <p className="text-sm text-muted-foreground">Kho chung chưa có mục nào ở cấp này.</p>;

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="choice"
        aria-label="Lọc theo trạng thái"
        // A phone keeps the filter to one row that scrolls sideways, so the tiles start near the
        // top (thien, U4c4a round 1).
        className="max-md:-mx-4 max-md:w-auto max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:pb-1 md:flex-wrap"
        value={active}
        onValueChange={(v) => setOnly(v as MapFilter)}
      >
        <ToggleGroupItem value="all" className="shrink-0 px-3">
          Tất cả <span className="text-muted-foreground tabular-nums">{words.length}</span>
        </ToggleGroupItem>
        {counts
          .filter(([, n]) => n > 0)
          .map(([s, n]) => (
            <ToggleGroupItem key={s} value={s} className="shrink-0 gap-1.5 px-3">
              <span aria-hidden className={cn('size-3 rounded-xs', MARK[s])} />
              <span className="first-letter:uppercase">{STATE_LABEL[s]}</span>
              <span className="text-muted-foreground tabular-nums">{n}</span>
            </ToggleGroupItem>
          ))}
      </ToggleGroup>
      {first && (
        <WordMap
          key={active}
          sections={sections}
          initial={first.expression}
          dense
          speaker={speaker}
          rate={rate}
        />
      )}
    </div>
  );
}
