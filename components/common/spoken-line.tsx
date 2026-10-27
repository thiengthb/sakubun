'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { SpeakButton } from '@/components/common/speak-button';
import { hasFurigana, parseFurigana } from '@/lib/japanese/furigana';
import { cn } from '@/lib/core/utils';

type WrapGroup = { length: number; wrap?: (children: ReactNode) => ReactNode };

export function SpokenLine({
  text,
  speakText,
  ruby,
  showFurigana = false,
  speaker,
  label,
  rate,
  truncate = false,
  playToken = null,
  className,
  aside,
  title = false,
  groups,
}: {
  text: string;
  speakText?: string;
  ruby?: string | null;
  showFurigana?: boolean;
  speaker?: number;
  label?: string;
  rate?: number;
  truncate?: boolean;
  playToken?: string | number | null;
  className?: string;
  /** Inline after the text, on its baseline: a reading in brackets beside a title. */
  aside?: ReactNode;
  /** A page title: a block row one title line tall (20px on a phone, 30px from 768px), so it
   * never grows the header. */
  title?: boolean;
  /** Words to wrap, such as Kaiwa's word lookup: runs of the text in order, `length` characters
   * each, each run wrapped by its own `wrap` (a popover trigger). A run never splits a reading.
   * Needs `ruby`; the furigana setting still decides whether readings show. */
  groups?: readonly WrapGroup[];
}) {
  const [ratio, setRatio] = useState(0);

  const segments =
    groups && ruby
      ? parseFurigana(ruby).map((s) => (showFurigana ? s : { text: s.text }))
      : showFurigana && ruby && hasFurigana(ruby)
        ? parseFurigana(ruby)
        : [{ text }];
  const total = segments.reduce((n, s) => n + [...s.text].length, 0);
  const lit = Math.round(ratio * total);

  const starts = segments.map((_, i) =>
    segments.slice(0, i).reduce((n, s) => n + [...s.text].length, 0),
  );
  // One unit per reading (never split) and one per plain character, so a group can end anywhere
  // outside a reading.
  const units = segments.flatMap((seg, si) => {
    const chars = [...seg.text];
    const start = starts[si];
    const litChars = chars.map((ch, ci) => (
      <span
        key={ci}
        className={cn(
          'transition-colors duration-150 ease-linear motion-reduce:transition-none',
          start + ci < lit && 'text-accent-brand',
        )}
      >
        {ch}
      </span>
    ));
    if (seg.reading) {
      return [
        {
          length: chars.length,
          node: (
            <ruby key={si}>
              {litChars}
              <rt
                className={cn(
                  'transition-colors duration-150 ease-linear motion-reduce:transition-none',
                  start < lit && 'text-accent-brand',
                )}
              >
                {seg.reading}
              </rt>
            </ruby>
          ),
        },
      ];
    }
    if (!groups) return [{ length: chars.length, node: <span key={si}>{litChars}</span> }];
    return litChars.map((node, ci) => ({
      length: 1,
      node: <span key={`${si}-${ci}`}>{node}</span>,
    }));
  });

  // The button is centred on the text's first line, at any size and on every page: its box is one
  // line of the text tall (h-lh), so the type classes sit on the row and the text inherits them.
  return (
    <span
      className={cn(
        'items-start gap-2 font-medium',
        truncate || title ? 'flex w-full' : 'inline-flex',
        className,
      )}
    >
      <span className="flex h-lh shrink-0 items-center">
        <SpeakButton
          text={speakText ?? text}
          speaker={speaker}
          label={label}
          rate={rate}
          onProgress={setRatio}
          playToken={playToken}
        />
      </span>
      <span lang="ja" className={cn('furigana', truncate && 'block min-w-0 flex-1 truncate')}>
        {wrapGroups(units, groups)}
        {aside}
      </span>
    </span>
  );
}

function wrapGroups(
  units: { length: number; node: ReactNode }[],
  groups: readonly WrapGroup[] | undefined,
): ReactNode {
  if (!groups) return units.map((u) => u.node);
  let at = 0;
  return groups.map((group, gi) => {
    const run: ReactNode[] = [];
    for (let n = 0; n < group.length && at < units.length; at++) {
      run.push(units[at].node);
      n += units[at].length;
    }
    return <Fragment key={gi}>{group.wrap ? group.wrap(run) : run}</Fragment>;
  });
}
