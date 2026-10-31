'use client';

import { useState, type ReactNode } from 'react';
import { SpeakButton } from '@/components/common/speak-button';
import { Truncate } from '@/components/ui/truncate';
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
  stopToken = null,
  onDone,
  onManualPlay,
  className,
  aside,
  title = false,
  speakerEnd = false,
  lookup = false,
  arrange,
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
  stopToken?: string | number | null;
  /** See SpeakButton: whole-script listening (K6c) moves on when a line ends by itself. */
  onDone?: (heard: boolean) => void;
  onManualPlay?: () => void;
  className?: string;
  /** Inline after the text, on its baseline: a reading in brackets beside a title. */
  aside?: ReactNode;
  /** A page title: a block row one title line tall (20px on a phone, 30px from 768px), so it
   * never grows the header. */
  title?: boolean;
  /** The speaker right after the text, small and pale (a card's title, thien 7.4 B1); a cut text
   * keeps it in sight. */
  speakerEnd?: boolean;
  /** The hover lookup on the sentence's words (components/common/word-lookup.tsx, 7.4b); 'hover'
   * where a tap belongs to something else, such as a card that opens. */
  lookup?: boolean | 'hover';
  /** Places the button and the sentence apart, such as Hội thoại's speaker beside its bubble
   * (thien, 7.4 round 3); the karaoke still lights the sentence as the button plays. */
  arrange?: (parts: { button: ReactNode; line: ReactNode }) => ReactNode;
}) {
  const [ratio, setRatio] = useState(0);

  const segments = showFurigana && ruby && hasFurigana(ruby) ? parseFurigana(ruby) : [{ text }];
  const total = segments.reduce((n, s) => n + [...s.text].length, 0);
  const lit = Math.round(ratio * total);

  const starts = segments.map((_, i) =>
    segments.slice(0, i).reduce((n, s) => n + [...s.text].length, 0),
  );
  const nodes = segments.map((seg, si) => {
    const start = starts[si];
    const litChars = [...seg.text].map((ch, ci) => (
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
    if (!seg.reading) return <span key={si}>{litChars}</span>;
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
  });

  // The button is centred on the text's first line, at any size and on every page: its box is one
  // line of the text tall (h-lh), so the type classes sit on the row and the text inherits them.
  const button = (
    <span className="flex h-lh shrink-0 items-center">
      <SpeakButton
        text={speakText ?? text}
        speaker={speaker}
        label={label}
        rate={rate}
        onProgress={setRatio}
        playToken={playToken}
        stopToken={stopToken}
        onDone={onDone}
        onManualPlay={onManualPlay}
        className={cn(speakerEnd && 'text-muted-foreground/70')}
      />
    </span>
  );
  const mark = lookup === 'hover' ? 'hover' : lookup || undefined;
  const content = (
    <>
      {nodes}
      {aside}
    </>
  );
  // A cut line shows in full in a tooltip, and only when it is cut (docs/ui-standard.md, Thẻ).
  const line = truncate ? (
    <Truncate full={text} className={cn('furigana', !speakerEnd && 'flex-1')}>
      <span lang="ja" data-lookup={mark}>
        {content}
      </span>
    </Truncate>
  ) : (
    <span lang="ja" data-lookup={mark} className="furigana">
      {content}
    </span>
  );
  if (arrange) return arrange({ button, line });
  return (
    <span
      className={cn(
        'font-medium',
        // After the text the button sits on its middle: a smaller aside (Hán Việt) on the same line
        // makes the line box taller than one line.
        speakerEnd ? 'items-center gap-0.5' : 'items-start gap-2',
        truncate || title ? 'flex w-full' : 'inline-flex',
        className,
      )}
    >
      {!speakerEnd && button}
      {line}
      {speakerEnd && button}
    </span>
  );
}
