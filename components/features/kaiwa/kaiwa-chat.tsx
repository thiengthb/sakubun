'use client';

import { useEffect, useRef, useState } from 'react';
import { MessagesSquare, Pause, Play, Square } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { KaiwaLine, type RubyLine } from '@/components/features/kaiwa/kaiwa-line';
import { useLocalState } from '@/components/common/use-session-state';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { chooseMe, layoutTurns, scriptSpeakers } from '@/lib/kaiwa/layout';
import { speakerVoices } from '@/lib/kaiwa/voices';
import { enterLine, nextStep, speakingPauseMs, type ListenState } from '@/lib/kaiwa/listen';
import { plainJapanese } from '@/lib/kaiwa/parse';
import { ttsUrl } from '@/lib/japanese/tts-url';

// A script read as a chat (phase 8, K3; view redo 7.4e) from the part the learner picks ("Tôi là").
// A toolbar that stays in sight while the chat scrolls holds who the learner is, hiding the
// Vietnamese, and covering their own lines to say them first; ↑ ↓ choose a line and Enter plays it.
// The editor's preview (7.4f) draws the same chat: the line under the cursor is ringed, and a click
// on a line sends the cursor there. "Nghe cả bài" (K6c) plays the lines in order from the chosen
// one, each in its speaker's voice, following the playing line down the page; Space pauses, Esc
// stops.
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
  const [stop, setStop] = useState<{ row: number; n: number } | null>(null);
  const [listen, setListen] = useState<ListenState | null>(null);
  const speakers = scriptSpeakers(lines);
  // Remembered per script on this device, so the learner comes back to the same part; a new script
  // starts from the part they took last, when it has that name.
  const [stored, setStored] = useLocalState<string | null>(`kaiwa-me:${scriptId ?? 'new'}`, null);
  const [last, setLast] = useLocalState<string | null>('kaiwa-me:last', null);
  const me = chooseMe(speakers, stored, last);
  const turns = layoutTurns(lines, me);
  // Each part its own voice; the learner's is the one in Cài đặt (K6b).
  const voices = voiceSpeaker === undefined ? null : speakerVoices(speakers, me, voiceSpeaker);
  const covering = cover && !preview;
  const isCovered = (i: number) => {
    const turn = turns[i];
    return covering && turn.kind === 'speech' && turn.side === 'mine' && !uncovered.has(i);
  };
  const voiceOf = (i: number) => {
    const speaker = turns[i]?.line.speaker;
    return (speaker == null ? undefined : voices?.get(speaker)) ?? voiceSpeaker;
  };

  // Whole-script listening: each step plays its line (or waits on the learner's covered one),
  // rings it and brings it to the middle of the screen, and asks the server for the next two
  // lines early so they start without a wait.
  const go = (state: ListenState | null) => {
    setListen(state);
    if (!state) return;
    setSelected(state.index);
    document
      .querySelectorAll('[data-slot="kaiwa-line"]')
      [state.index]?.scrollIntoView({ block: 'center' });
    if (state.paused || state.phase !== 'play') return;
    // A covered line has no speaker button: after the learner's turn it opens, then the model plays.
    if (isCovered(state.index)) setUncovered((u) => new Set(u).add(state.index));
    setPlay((p) => ({ row: state.index, n: (p?.n ?? 0) + 1 }));
    for (const i of [state.index + 1, state.index + 2]) {
      const line = turns[i]?.line;
      if (line) fetch(ttsUrl(plainJapanese(line.japanese), voiceOf(i), speechRate)).catch(() => {});
    }
  };
  const stopLine = (row: number) => setStop((s) => ({ row, n: (s?.n ?? 0) + 1 }));
  const startListening = () => go(enterLine(selected ?? 0, isCovered));
  const pauseListening = () => {
    if (!listen) return;
    stopLine(listen.index);
    setListen({ ...listen, paused: true });
  };
  const resumeListening = () => listen && go(enterLine(listen.index, isCovered));
  const stopListening = () => {
    if (listen) stopLine(listen.index);
    setListen(null);
  };
  const lineDone = (i: number, heard: boolean) => {
    if (!listen || listen.paused || listen.phase !== 'play' || listen.index !== i) return;
    if (!heard) return setListen(null);
    go(nextStep(listen, turns.length, isCovered));
  };
  // A press on another line's speaker while listening carries on from that line.
  const lineChosen = (i: number) => {
    if (!listen || listen.index === i) return;
    stopLine(listen.index);
    setListen({ index: i, phase: 'play', paused: false });
    setSelected(i);
  };
  // A press that stops the line being read pauses listening, so Tiếp tục picks it up again.
  const lineStopped = (i: number) => {
    if (listen && !listen.paused && listen.index === i) setListen({ ...listen, paused: true });
  };

  // The learner's turn on a covered line: a pause about as long as the sentence, then the model.
  // Timed from when the turn began: other renders (↑ ↓) do not restart it.
  const gapLine = listen && !listen.paused && listen.phase === 'gap' ? turns[listen.index] : null;
  const gapMs = gapLine ? speakingPauseMs(plainJapanese(gapLine.line.japanese), speechRate) : null;
  const advanceRef = useRef(() => {});
  useEffect(() => {
    advanceRef.current = () => listen && go(nextStep(listen, turns.length, isCovered));
  });
  useEffect(() => {
    if (gapMs === null) return;
    const timer = window.setTimeout(() => advanceRef.current(), gapMs);
    return () => window.clearTimeout(timer);
  }, [listen, gapMs]);

  useEffect(() => {
    if (preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (e.ctrlKey || e.metaKey || e.altKey || turns.length === 0) return;
      if (listen && e.key === 'Escape') {
        e.preventDefault();
        stopListening();
        return;
      }
      if (listen && e.key === ' ') {
        if (e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"]'))
          return;
        e.preventDefault();
        if (listen.paused) resumeListening();
        else pauseListening();
        return;
      }
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
        if (listen && listen.index !== selected) {
          // While listening, Enter on another line carries on from there, as its speaker would.
          stopLine(listen.index);
          go(enterLine(selected, isCovered));
        } else if (isCovered(selected)) setUncovered((s) => new Set(s).add(selected));
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
            {listen ? (
              <>
                <Button
                  variant="outline"
                  onClick={listen.paused ? resumeListening : pauseListening}
                >
                  {listen.paused ? <Play aria-hidden /> : <Pause aria-hidden />}
                  {listen.paused ? 'Tiếp tục' : 'Tạm dừng'}
                </Button>
                <Button variant="outline" onClick={stopListening}>
                  <Square aria-hidden />
                  Dừng
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={startListening}>
                <Play aria-hidden />
                Nghe cả bài
              </Button>
            )}
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
            stopToken={stop?.row === i ? stop.n : null}
            onDone={(heard) => lineDone(i, heard)}
            onManualPlay={() => lineChosen(i)}
            onManualStop={() => lineStopped(i)}
            lookup={!preview}
            voiceSpeaker={voiceOf(i)}
            speechRate={speechRate}
          />
        ))}
      </ol>
    </div>
  );
}
