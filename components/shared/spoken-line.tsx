'use client';

import { useState } from 'react';
import { SpeakButton } from '@/components/shared/speak-button';
import { hasFurigana, parseFurigana } from '@/lib/furigana';
import { cn } from '@/lib/utils';

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
        truncate ? 'flex w-full' : 'inline-flex',
      )}
    >
      <SpeakButton
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
      </span>
    </span>
  );
}
