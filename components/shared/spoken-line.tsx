'use client';

import { useState } from 'react';
import { SpeakButton } from '@/components/shared/speak-button';
import { hasFurigana, parseFurigana } from '@/lib/furigana';
import { cn } from '@/lib/utils';

/**
 * A line of Japanese text with an inline play button that produces a KARAOKE highlight: as the reference
 * audio plays, characters fill with the app theme color left→right, synced to playback (VOICEVOX
 * currentTime/duration; Web Speech word boundaries). Optionally shows furigana <ruby> on top (from
 * Claude's `漢字[かな]` markup) — the ruby base is highlighted per-character alongside the plain kana, so
 * the sweep and the reading stay together. `showFurigana` is driven by the user's furiganaMode setting.
 * The highlight resets when playback stops/ends. Used for the đề + reference answer in /history and for
 * the Japanese expression elsewhere.
 */
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
  /** Plain Japanese surface — what SHOWS (and, by default, what's spoken). */
  text: string;
  /** Override the spoken text when it must differ from the display (e.g. a grammar pattern shows the
   * 〜 placeholder but the voice reads the form without it). Defaults to `text`. */
  speakText?: string;
  /** `漢字[かな]` furigana markup for the same text (optional); rendered as ruby when `showFurigana`. */
  ruby?: string | null;
  /** Whether to render furigana ruby (from the user's furiganaMode). */
  showFurigana?: boolean;
  speaker?: number;
  label?: string;
  /** Default playback speed (from the user's setting); a repeat-press slows it (see SpeakButton). */
  rate?: number;
  /** Clip the text to one line + fill the row (for compact list cards). */
  truncate?: boolean;
  /**
   * Where the speak button sits when the JA text wraps onto more than one line. `end` (default) keeps
   * the historic single-line behaviour — the button on the text baseline. `start` aligns it to the
   * FIRST line, which is what a multi-line block needs: with `end` the button drifts to the bottom-left
   * and reads as though it belonged to the last line rather than the whole block (visible on the
   * resource cards below md, where a long pattern wraps).
   */
  align?: 'end' | 'start';
  /** Auto-read latch, forwarded to the SpeakButton — a NEW value reads this line once. See SpeakButton. */
  playToken?: string | number | null;
  className?: string;
}) {
  const [ratio, setRatio] = useState(0);

  const segments = showFurigana && ruby && hasFurigana(ruby) ? parseFurigana(ruby) : [{ text }];
  const total = segments.reduce((n, s) => n + [...s.text].length, 0);
  const lit = Math.round(ratio * total);

  // Each segment's starting char index (pure prefix-sum — a few segments per sentence, so O(n²) is fine
  // and it avoids a mutable running counter, which the React Compiler forbids inside the render map).
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
      {/* `furigana` keeps the ruby readings hidden until the line is hovered — a hint, not a spoiler
          (same behaviour as FuriganaText); the per-char karaoke colour still shows on the base always. */}
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
