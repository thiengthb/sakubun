import { SpokenLine } from '@/components/common/spoken-line';
import { LIST_CARD } from '@/components/common/list-card';
import type { Turn } from '@/lib/kaiwa/layout';
import { plainJapanese, type ScriptLine } from '@/lib/kaiwa/parse';
import { cn } from '@/lib/core/utils';

// A script line with the furigana to show (worked out on save, or the author's own, K4).
export type RubyLine = ScriptLine & { ruby: string };

// The bubble's fill, by tone (lib/kaiwa/layout.ts): the learner in the brand tint, each other
// speaker in a neutral of their own (grey, blue grey, beige), apart in light and dark (thien, 7.4).
const BUBBLE_TONES = ['bg-accent-brand/10', 'bg-muted', 'bg-info-wash', 'bg-warn-wash'];

// One line of a script, read as a chat (thien, 2026-10-27; view redo 7.4e): the learner's lines in
// tinted bubbles on the left, the others' on the right, the scene centred between them, and a
// monologue as plain cards. The speaker's name heads each run in small muted type, as in a group
// chat, and the speaker button stands beside the bubble on its empty side, as in Messenger: pale
// until the mouse is on the line. Every sentence has the shared word lookup (7.4b).
export function KaiwaLine({
  turn,
  showMeaning,
  showFurigana,
  covered,
  onUncover,
  selected,
  playToken,
  stopToken = null,
  onDone,
  onManualPlay,
  lookup = true,
  voiceSpeaker,
  speechRate,
}: {
  turn: Turn<RubyLine>;
  showMeaning: boolean;
  showFurigana: boolean;
  /** "Che câu của tôi": the learner says it first; the bubble shows the meaning until tapped. */
  covered: boolean;
  onUncover: () => void;
  /** Chosen with ↑ ↓; Enter plays it. */
  selected: boolean;
  playToken: number | null;
  /** Whole-script listening (K6c): stops this line, and hears when it ends or is pressed. */
  stopToken?: number | null;
  onDone?: (heard: boolean) => void;
  onManualPlay?: () => void;
  /** Off in the editor's preview, which changes as the learner types. */
  lookup?: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
}) {
  const { line } = turn;
  const spokenProps = {
    text: plainJapanese(line.japanese),
    ruby: line.ruby,
    showFurigana,
    speaker: voiceSpeaker,
    rate: speechRate,
    label: 'Nghe câu',
    lookup,
    playToken,
    stopToken,
    onDone,
    onManualPlay,
  } as const;
  const meaning = line.translation && showMeaning && (
    <p className="text-sm text-muted-foreground">{line.translation}</p>
  );
  const ring = selected && 'ring-2 ring-ring/60';

  if (turn.kind === 'narration') {
    return (
      <li
        data-slot="kaiwa-line"
        data-row={line.row}
        className={cn(LIST_CARD.base, 'space-y-1', ring)}
      >
        <SpokenLine {...spokenProps} />
        {meaning}
      </li>
    );
  }

  // The scene reads like a stage direction: centred between two rules, small and muted, so it
  // never looks like anyone's turn.
  if (turn.kind === 'scene') {
    return (
      <li
        data-slot="kaiwa-line"
        data-row={line.row}
        data-kind="scene"
        className={cn(
          'flex items-center gap-3 rounded-lg py-1 text-xs text-muted-foreground',
          ring,
        )}
      >
        <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
        <div className="max-w-5/6 space-y-0.5 text-center md:max-w-2/3">
          <SpokenLine {...spokenProps} className="font-normal" />
          {meaning && <p>{line.translation}</p>}
        </div>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
      </li>
    );
  }

  const mine = turn.side === 'mine';
  const bubble = cn(
    'min-w-0 space-y-1 rounded-2xl px-3 py-2',
    BUBBLE_TONES[Math.min(turn.tone, BUBBLE_TONES.length - 1)],
    turn.firstOfRun && (mine ? 'rounded-tl-sm' : 'rounded-tr-sm'),
    ring,
  );
  return (
    <li
      data-slot="kaiwa-line"
      data-row={line.row}
      data-side={turn.side}
      className={cn(
        'group/line flex flex-col',
        mine ? 'items-start' : 'items-end',
        turn.firstOfRun ? 'pt-1' : '-mt-1.5',
      )}
    >
      {turn.firstOfRun && (
        <span data-slot="kaiwa-speaker" className="mb-0.5 px-3 text-xs text-muted-foreground">
          {line.speaker}
        </span>
      )}
      <div
        className={cn('flex max-w-5/6 items-end gap-1 md:max-w-2/3', !mine && 'flex-row-reverse')}
      >
        {covered ? (
          <button
            type="button"
            data-slot="kaiwa-covered"
            onClick={onUncover}
            className={cn(
              bubble,
              'border border-dashed border-accent-brand/40 bg-transparent text-left opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-ring',
            )}
          >
            {line.translation && <span className="block text-sm">{line.translation}</span>}
            <span className="block text-xs text-muted-foreground">Bấm để xem câu tiếng Nhật</span>
          </button>
        ) : (
          <SpokenLine
            {...spokenProps}
            arrange={({ button, line: sentence }) => (
              <>
                <div className={bubble}>
                  <p className="font-medium">{sentence}</p>
                  {meaning}
                </div>
                <span className="text-muted-foreground/60 group-hover/line:text-foreground max-md:text-muted-foreground [&_button]:text-inherit">
                  {button}
                </span>
              </>
            )}
          />
        )}
      </div>
    </li>
  );
}
