'use client';

import { useState, type ReactNode } from 'react';
import { SpeakButton } from '@/components/common/speak-button';
import { hasFurigana, parseFurigana } from '@/lib/japanese/furigana';
import { cn } from '@/lib/core/utils';

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
}) {
  const [ratio, setRatio] = useState(0);

  const segments = showFurigana && ruby && hasFurigana(ruby) ? parseFurigana(ruby) : [{ text }];
  const total = segments.reduce((n, s) => n + [...s.text].length, 0);
  const lit = Math.round(ratio * total);

  const starts = segments.map((_, i) =>
    segments.slice(0, i).reduce((n, s) => n + [...s.text].length, 0),
  );
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
        {segments.map((seg, si) => {
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
            return (
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
            );
          }
          return <span key={si}>{litChars}</span>;
        })}
        {aside}
      </span>
    </span>
  );
}
