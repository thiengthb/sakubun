'use client';

import { useEffect, useState } from 'react';
import { SpokenLine } from '@/components/common/spoken-line';
import { ButtonLink } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { WordState } from '@/lib/library/level-sets';
import { STATE_LABEL } from '@/lib/library/level-screen';
import { cn } from '@/lib/core/utils';
import { TILE } from './word-marks';

// The set screen's map (U4c3, docs/plans/2026-11-14-u4-kho.md): the set's words as tiles, one open
// at a time. On a laptop the open word sits in a panel beside the map; on a phone a tap opens it in
// a sheet from the bottom, so the map keeps the whole width.

export interface MapWord {
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string | null;
  state: WordState;
  lapses: number;
  link: { label: string; href: string };
}

const STATE_BADGE: Record<WordState, string> = {
  mastered: 'bg-accent-brand/15 text-accent-brand',
  learning: 'bg-accent-brand/10 text-accent-brand',
  due: 'bg-warn/15 text-warn',
  new: 'bg-muted text-muted-foreground',
  none: 'bg-muted text-muted-foreground',
  paused: 'bg-muted text-muted-foreground',
};

// Matches the md breakpoint, where the panel beside the map takes over from the sheet.
const WIDE = '(min-width: 48rem)';

export function SetWordMap({
  words,
  initial,
  speaker,
  rate,
}: {
  words: MapWord[];
  initial: string;
  speaker?: number;
  rate?: number;
}) {
  // The open word by its expression, not its place: a refresh (LiveRefresh) that drops an earlier
  // word must not slide the panel onto the next one. A word gone from the set closes the detail.
  const [open, setOpen] = useState(initial);
  const [sheet, setSheet] = useState(false);
  // Turned to landscape or widened past md, the panel beside the map takes over: close the sheet,
  // or its overlay would stay over the page.
  useEffect(() => {
    const wide = window.matchMedia(WIDE);
    const onChange = () => wide.matches && setSheet(false);
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);
  const word = words.find((w) => w.expression === open);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
      <ul aria-label="Các mục của chặng" className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {words.map((w) => (
          <li key={w.expression}>
            <button
              type="button"
              aria-pressed={w.expression === open}
              onClick={() => {
                setOpen(w.expression);
                if (!window.matchMedia(WIDE).matches) setSheet(true);
              }}
              className={cn(
                'flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-20',
                TILE[w.state],
                w.expression === open && 'md:outline-2 md:outline-offset-2 md:outline-accent-brand',
              )}
            >
              <span lang="ja" className="max-w-full truncate text-base font-semibold md:text-lg">
                {w.expression}
              </span>
              <span className="max-w-full truncate text-xs text-muted-foreground max-sm:hidden">
                {w.meaningVi}
              </span>
              <span className="sr-only">{STATE_LABEL[w.state]}</span>
            </button>
          </li>
        ))}
      </ul>

      {word && (
        <aside
          aria-label="Mục đang mở"
          className="sticky top-4 rounded-xl border border-border bg-card p-4 max-md:hidden"
        >
          {/* Keyed by word, so another word starts with its own speaker, not the last one's audio. */}
          <WordDetail key={word.expression} word={word} speaker={speaker} rate={rate} />
        </aside>
      )}

      <Sheet open={sheet && word != null} onOpenChange={setSheet}>
        {word && (
          <SheetContent
            side="bottom"
            className="max-h-[calc(100dvh-var(--spacing)*12)] gap-0 overflow-y-auto rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
          >
            <SheetTitle className="sr-only">{word.expression}</SheetTitle>
            <SheetDescription className="sr-only">{STATE_LABEL[word.state]}</SheetDescription>
            <WordDetail key={word.expression} word={word} speaker={speaker} rate={rate} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

function WordDetail({ word, speaker, rate }: { word: MapWord; speaker?: number; rate?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium first-letter:uppercase',
            STATE_BADGE[word.state],
          )}
        >
          {STATE_LABEL[word.state]}
        </span>
        {word.lapses > 0 && <span className="text-xs text-warn">quên {word.lapses} lần</span>}
      </div>
      <div className="flex flex-col gap-1">
        <SpokenLine
          text={word.expression}
          speaker={speaker}
          rate={rate}
          className="text-title1 font-semibold"
        />
        {(word.reading || word.hanviet) && (
          <span className="text-sm text-muted-foreground">
            {word.reading && <span lang="ja">{word.reading}</span>}
            {word.reading && word.hanviet && ' · '}
            {word.hanviet && <span lang="vi">{word.hanviet.toUpperCase()}</span>}
          </span>
        )}
      </div>
      {word.meaningVi && <p className="text-body font-medium">{word.meaningVi}</p>}
      <div className="flex justify-end">
        <ButtonLink href={word.link.href}>{word.link.label}</ButtonLink>
      </div>
    </div>
  );
}
