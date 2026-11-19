'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { SpokenLine } from '@/components/common/spoken-line';
import { ButtonLink } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { WordState } from '@/lib/library/level-sets';
import { STATE_LABEL } from '@/lib/library/level-screen';
import type { WordCard } from '@/lib/library/set-screen';
import { cn } from '@/lib/core/utils';
import { TILE } from './word-marks';
import { TakeWordButton } from './take-buttons';

// A map of words as tiles, one open at a time (docs/plans/2026-11-14-u4-kho.md): a set's 20 on
// the set screen (U4c3), the whole level cut by set on the level screen's map (U4c4). On a laptop
// the open word sits in a panel beside the map; on a phone a tap opens it in a sheet from the
// bottom, so the map keeps the whole width.

export interface MapSection {
  key: string;
  // What the section's tiles are called ("Chặng 3"), and the heading over them; the set screen has
  // one section and no heading.
  label: string;
  title?: ReactNode;
  words: WordCard[];
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

export function WordMap({
  sections,
  initial,
  dense = false,
  speaker,
  rate,
}: {
  sections: MapSection[];
  initial: string;
  // The level's map: the word alone on each tile, more tiles a row, and its set in the detail.
  dense?: boolean;
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
  const word = sections.flatMap((s) => s.words).find((w) => w.expression === open);
  const tiles = (words: WordCard[], label: string) => (
    <ul
      aria-label={label}
      className={cn(
        'grid gap-2',
        // Dense: ten a row on a wide screen, five or four on a narrower one, so a set of 20 fills
        // whole rows; a phone keeps four so a word of four kana is not cut (thien, U4c4a round 1).
        dense ? 'grid-cols-4 sm:grid-cols-5 xl:grid-cols-10' : 'grid-cols-4 sm:grid-cols-5',
      )}
    >
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
              'flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              dense ? 'min-h-12' : 'min-h-16 md:min-h-20',
              TILE[w.state],
              w.expression === open && 'md:outline-2 md:outline-offset-2 md:outline-accent-brand',
            )}
          >
            <span
              lang="ja"
              className={cn('max-w-full truncate text-base font-semibold', !dense && 'md:text-lg')}
            >
              {w.expression}
            </span>
            {!dense && (
              <span className="max-w-full truncate text-xs text-muted-foreground max-sm:hidden">
                {w.meaningVi}
              </span>
            )}
            <span className="sr-only">{STATE_LABEL[w.state]}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
      {sections.length === 1 && !sections[0]!.title ? (
        tiles(sections[0]!.words, 'Các mục của chặng')
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {sections.map((s) => (
            <section key={s.key} aria-labelledby={`map-${s.key}`} className="flex flex-col gap-2">
              <h3 id={`map-${s.key}`} className="text-sm font-semibold">
                {s.title}
              </h3>
              {tiles(s.words, `Các mục của ${s.label.toLowerCase()}`)}
            </section>
          ))}
        </div>
      )}

      {word && (
        <aside
          aria-label="Mục đang mở"
          className="sticky top-4 rounded-xl border border-border bg-card p-4 max-md:hidden"
        >
          {/* Keyed by word, so another word starts with its own speaker, not the last one's audio. */}
          <WordDetail
            key={word.expression}
            word={word}
            showSet={dense}
            speaker={speaker}
            rate={rate}
          />
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
            <WordDetail
              key={word.expression}
              word={word}
              showSet={dense}
              speaker={speaker}
              rate={rate}
            />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

function WordDetail({
  word,
  showSet,
  speaker,
  rate,
}: {
  word: WordCard;
  showSet: boolean;
  speaker?: number;
  rate?: number;
}) {
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
      <div className="flex flex-wrap justify-end gap-2">
        {showSet && (
          <ButtonLink href={word.set.href} variant="outline">
            Chặng {word.set.number}
          </ButtonLink>
        )}
        {word.state === 'none' ? (
          <>
            <ButtonLink href={word.link.href} variant="outline">
              {word.link.label}
            </ButtonLink>
            <TakeWordButton entryId={word.entryId} expression={word.expression} />
          </>
        ) : (
          <ButtonLink href={word.link.href}>{word.link.label}</ButtonLink>
        )}
      </div>
    </div>
  );
}
