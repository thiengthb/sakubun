import { SpokenLine } from '@/components/common/spoken-line';
import { LIST_CARD } from '@/components/common/list-card';
import type { Turn } from '@/lib/kaiwa/layout';
import { plainJapanese, type ScriptLine } from '@/lib/kaiwa/parse';
import { cn } from '@/lib/core/utils';

// A script line with the furigana to show: worked out on save, or the author's own (K4).
export type RubyLine = ScriptLine & { ruby: string };

// The speaker's mark, by tone (lib/kaiwa/layout.ts): the learner in the brand colour, the others
// in neutral shades that stay apart in light and dark.
const MARK_TONES = [
  'bg-accent-brand text-white',
  'bg-foreground text-background',
  'bg-muted-foreground text-background',
  'bg-muted text-foreground',
];

// One line of a script, read as a chat (thien, 2026-10-27): the learner's lines in tinted bubbles
// on the left, the others' in grey bubbles on the right, the scene centred between them, and a
// monologue as plain cards. The speaker's mark shows on the first line of each run.
export function KaiwaLine({
  turn,
  showMeaning,
  showFurigana,
  voiceSpeaker,
  speechRate,
}: {
  turn: Turn<RubyLine>;
  showMeaning: boolean;
  showFurigana: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
}) {
  const { line } = turn;
  const spoken = (
    <SpokenLine
      text={plainJapanese(line.japanese)}
      ruby={line.ruby}
      showFurigana={showFurigana}
      speaker={voiceSpeaker}
      rate={speechRate}
      label="Nghe câu"
    />
  );
  const meaning = line.translation && showMeaning && (
    <p className="text-sm text-muted-foreground">{line.translation}</p>
  );

  if (turn.kind === 'narration') {
    return (
      <li data-slot="kaiwa-line" className={cn(LIST_CARD.base, 'space-y-1')}>
        {spoken}
        {meaning}
      </li>
    );
  }

  // The scene reads like a stage direction: centred between two rules, in the muted colour, so it
  // never looks like anyone's turn.
  if (turn.kind === 'scene') {
    return (
      <li
        data-slot="kaiwa-line"
        data-kind="scene"
        className="flex items-center gap-3 py-1 text-muted-foreground"
      >
        <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
        <div className="max-w-5/6 space-y-0.5 text-center md:max-w-2/3">
          {spoken}
          {meaning}
        </div>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
      </li>
    );
  }

  const mine = turn.side === 'mine';
  return (
    <li
      data-slot="kaiwa-line"
      data-side={turn.side}
      className={cn(
        'flex items-start gap-2',
        !mine && 'flex-row-reverse',
        !turn.firstOfRun && '-mt-1',
      )}
    >
      {turn.firstOfRun ? (
        <span
          role="img"
          aria-label={`Người nói ${line.speaker}`}
          className={cn(
            'flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-medium whitespace-nowrap',
            MARK_TONES[Math.min(turn.tone, MARK_TONES.length - 1)],
          )}
        >
          {line.speaker}
        </span>
      ) : (
        <span aria-hidden className="w-8 shrink-0" />
      )}
      <div
        className={cn(
          'min-w-0 max-w-5/6 space-y-1 rounded-2xl px-3 py-2 md:max-w-2/3',
          mine ? 'bg-accent-brand/10' : 'bg-muted',
          turn.firstOfRun && (mine ? 'rounded-tl-sm' : 'rounded-tr-sm'),
        )}
      >
        {spoken}
        {meaning}
      </div>
    </li>
  );
}
