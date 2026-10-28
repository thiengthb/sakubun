'use client';

import { useEffect, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { KaiwaLine, type RubyLine } from '@/components/features/kaiwa/kaiwa-line';
import { useLocalState } from '@/components/common/use-session-state';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { chooseMe, layoutTurns, scriptSpeakers } from '@/lib/kaiwa/layout';

// A script read as a chat (phase 8, K3; view redo 7.4e) from the part the learner picks ("Tôi là").
// A toolbar that stays in sight while the chat scrolls holds who the learner is, hiding the
// Vietnamese, and covering their own lines to say them first; ↑ ↓ choose a line and Enter plays it.
// The editor's preview (7.4f) draws the same chat: the line under the cursor is ringed, and a click
// on a line sends the cursor there.
export function KaiwaChat({
  scriptId,
  lines,
  voiceSpeaker,
  speechRate,
  showFurigana,
  preview,
}: {
  /** Where "Tôi là" is remembered; a new script has none yet. */
  scriptId: string | null;
  lines: RubyLine[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
  preview?: { row: number | null; onPick: (row: number) => void };
}) {
  const [showMeaning, setShowMeaning] = useState(true);
  const [cover, setCover] = useState(false);
  const [uncovered, setUncovered] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [play, setPlay] = useState<{ row: number; n: number } | null>(null);
  const speakers = scriptSpeakers(lines);
  // Remembered per script on this device, so the learner comes back to the same part; a new script
  // starts from the part they took last, when it has that name.
  const [stored, setStored] = useLocalState<string | null>(`kaiwa-me:${scriptId ?? 'new'}`, null);
  const [last, setLast] = useLocalState<string | null>('kaiwa-me:last', null);
  const me = chooseMe(speakers, stored, last);
  const turns = layoutTurns(lines, me);
  const covering = cover && !preview;
  const isCovered = (i: number) => {
    const turn = turns[i];
    return covering && turn.kind === 'speech' && turn.side === 'mine' && !uncovered.has(i);
  };

  useEffect(() => {
    if (preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (e.ctrlKey || e.metaKey || e.altKey || turns.length === 0) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        const next =
          selected === null
            ? step > 0
              ? 0
              : turns.length - 1
            : Math.min(turns.length - 1, Math.max(0, selected + step));
        setSelected(next);
        document
          .querySelectorAll('[data-slot="kaiwa-line"]')
          [next]?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' && selected !== null) {
        // Enter on a focused control is that control's own.
        if (e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"]'))
          return;
        e.preventDefault();
        if (isCovered(selected)) setUncovered((s) => new Set(s).add(selected));
        else setPlay((p) => ({ row: selected, n: (p?.n ?? 0) + 1 }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (lines.length === 0) {
    return <EmptyState icon={MessagesSquare} title="Kịch bản này chưa có câu nào" />;
  }
  return (
    <div className="space-y-3">
      <div
        data-slot="kaiwa-toolbar"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 bg-background py-2"
      >
        {speakers.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Tôi là</span>
            <ToggleGroup
              type="single"
              variant="choice"
              aria-label="Tôi là"
              value={me ?? ''}
              onValueChange={(value) => {
                if (!value) return;
                setStored(value);
                setLast(value);
              }}
              className="flex-wrap"
            >
              {speakers.map((speaker) => (
                <ToggleGroupItem key={speaker} value={speaker} className="px-3">
                  {speaker}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        {!preview && (
          <div className="flex flex-wrap items-center gap-2">
            <Toggle
              variant="choice"
              pressed={!showMeaning}
              onPressedChange={(hide) => setShowMeaning(!hide)}
              className="px-3"
            >
              Ẩn nghĩa
            </Toggle>
            {speakers.length > 0 && (
              <Toggle
                variant="choice"
                pressed={cover}
                onPressedChange={(on) => {
                  setCover(on);
                  setUncovered(new Set());
                }}
                className="px-3"
              >
                Che câu của tôi
              </Toggle>
            )}
          </div>
        )}
      </div>
      <ol
        className="space-y-2"
        onClick={
          preview &&
          ((e) => {
            const li = (e.target as HTMLElement).closest<HTMLElement>('[data-row]');
            if (li && !(e.target as HTMLElement).closest('button')) {
              preview.onPick(Number(li.dataset.row));
            }
          })
        }
      >
        {turns.map((turn, i) => (
          <KaiwaLine
            key={turn.line.row}
            turn={turn}
            showMeaning={showMeaning}
            showFurigana={showFurigana}
            covered={isCovered(i)}
            onUncover={() => setUncovered((s) => new Set(s).add(i))}
            selected={preview ? preview.row === turn.line.row : selected === i}
            playToken={play?.row === i ? play.n : null}
            lookup={!preview}
            voiceSpeaker={voiceSpeaker}
            speechRate={speechRate}
          />
        ))}
      </ol>
    </div>
  );
}
