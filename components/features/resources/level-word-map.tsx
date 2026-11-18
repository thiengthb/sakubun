'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WORD_STATES, type WordState } from '@/lib/library/level-sets';
import { STATE_LABEL } from '@/lib/library/level-screen';
import { firstOpenWord, type WordCard } from '@/lib/library/set-screen';
import { cn } from '@/lib/core/utils';
import { WordMap, type MapSection } from './word-map';
import { MARK } from './word-marks';

// The level screen's "Bản đồ ô" (U4c4, docs/plans/2026-11-14-u4-kho.md, sketch u4c-r2/b.jpg): a
// tile per word of the whole level, cut by set, with the legend as a filter.

type Filter = 'all' | WordState;

export function LevelWordMap({
  words,
  speaker,
  rate,
}: {
  words: WordCard[];
  speaker?: number;
  rate?: number;
}) {
  const [only, setOnly] = useState<Filter>('all');
  const counts = WORD_STATES.map((s) => [s, words.filter((w) => w.state === s).length] as const);
  const shown = only === 'all' ? words : words.filter((w) => w.state === only);
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
  const first = words[firstOpenWord(words)];

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="choice"
        aria-label="Lọc theo trạng thái"
        className="flex-wrap"
        value={only}
        onValueChange={(v) => setOnly(v as Filter)}
      >
        <ToggleGroupItem value="all" className="px-3">
          Tất cả <span className="text-muted-foreground tabular-nums">{words.length}</span>
        </ToggleGroupItem>
        {counts
          .filter(([, n]) => n > 0)
          .map(([s, n]) => (
            <ToggleGroupItem key={s} value={s} className="gap-1.5 px-3">
              <span aria-hidden className={cn('size-3 rounded-xs', MARK[s])} />
              <span className="first-letter:uppercase">{STATE_LABEL[s]}</span>
              <span className="text-muted-foreground tabular-nums">{n}</span>
            </ToggleGroupItem>
          ))}
      </ToggleGroup>
      {first && (
        <WordMap
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
