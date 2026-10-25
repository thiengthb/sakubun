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
  align = 'end',
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
  align?: 'end' | 'start';
  playToken?: string | number | null;
  className?: string;
  /** Inline after the text, on its baseline: a reading in brackets beside a title. */
  aside?: ReactNode;
  /** A page title: a block row whose button sits inside the title's line box, so the row is
   * exactly one title line tall (20px on a phone, 30px from 768px) and never grows the header. */
  title?: boolean;
}) {
  const [ratio, setRatio] = useState(0);

  const segments = showFurigana && ruby && hasFurigana(ruby) ? parseFurigana(ruby) : [{ text }];
  const total = segments.reduce((n, s) => n + [...s.text].length, 0);
  const lit = Math.round(ratio * total);

  const starts = segments.map((_, i) =>
    segments.slice(0, i).reduce((n, s) => n + [...s.text].length, 0),
  );
  return (
    <span
      className={cn(
        'gap-2',
        align === 'start' ? 'items-start' : 'items-end',
        truncate || title ? 'flex w-full' : 'inline-flex',
      )}
    >
      <SpeakButton
        className={cn(title && '-my-0.5 md:my-0.75')}
        text={speakText ?? text}
        speaker={speaker}
        label={label}
        rate={rate}
        onProgress={setRatio}
        playToken={playToken}
      />
      <span
        lang="ja"
        className={cn(
          'furigana font-medium',
          truncate && 'block min-w-0 flex-1 truncate',
          className,
        )}
      >
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
