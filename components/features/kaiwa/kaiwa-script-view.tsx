'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessagesSquare, Pencil, Sparkles } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { ShortcutsHelp, type Shortcut } from '@/components/common/shortcuts-help';
import { KaiwaLine } from '@/components/features/kaiwa/kaiwa-line';
import { useLocalState } from '@/components/common/use-session-state';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { chooseMe, layoutTurns, scriptSpeakers } from '@/lib/kaiwa/layout';
import { editScriptCommand } from '@/components/features/kaiwa/kaiwa-commands';
import type { RubyLine } from '@/components/features/kaiwa/kaiwa-line';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'E'], does: 'Sửa kịch bản' },
  { keys: ['↑', '↓'], does: 'Chọn câu' },
  { keys: ['Enter'], does: 'Nghe câu đang chọn' },
];

// One script (phase 8, K3; view redo 7.4e): its lines as a chat seen from the part the learner picks
// ("Tôi là"). A toolbar that stays in sight while the chat scrolls holds who the learner is, hiding
// the Vietnamese, and covering their own lines to say them first. Changes go through Claude ("Sửa
// với AI") or the web editor ("Sửa", which also holds Xoá); the `?` lists the page's keys.
export function KaiwaScriptView({
  script,
  lines,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  script: { id: string; title: string; updatedAt: Date };
  lines: RubyLine[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const router = useRouter();
  const [showMeaning, setShowMeaning] = useState(true);
  const [cover, setCover] = useState(false);
  const [uncovered, setUncovered] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [play, setPlay] = useState<{ row: number; n: number } | null>(null);
  const speakers = scriptSpeakers(lines);
  // Remembered per script on this device, so the learner comes back to the same part; a new script
  // starts from the part they took last, when it has that name.
  const [stored, setStored] = useLocalState<string | null>(`kaiwa-me:${script.id}`, null);
  const [last, setLast] = useLocalState<string | null>('kaiwa-me:last', null);
  const me = chooseMe(speakers, stored, last);
  const turns = layoutTurns(lines, me);
  const isCovered = (i: number) => {
    const turn = turns[i];
    return cover && turn.kind === 'speech' && turn.side === 'mine' && !uncovered.has(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        router.push(`/kaiwa/${script.id}/edit`);
        return;
      }
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

  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="kaiwa" self />}
      title={script.title}
      meta={
        <span>
          {lines.length} câu · Cập nhật <RelativeTime value={script.updatedAt} />
        </span>
      }
      actions={
        <>
          <ExpandingIconButton asChild icon={Pencil} label="Sửa">
            <Link href={`/kaiwa/${script.id}/edit`} />
          </ExpandingIconButton>
          <CopyCommandButton
            command={editScriptCommand(script.title)}
            label="Sửa với AI"
            size="default"
            expandOnHover
            icon={Sparkles}
          />
          <ShortcutsHelp shortcuts={SHORTCUTS} />
        </>
      }
      actionsOnPhone="split"
    >
      {lines.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="Kịch bản này chưa có câu nào" />
      ) : (
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
          </div>
          <ol className="space-y-2">
            {turns.map((turn, i) => (
              <KaiwaLine
                key={turn.line.row}
                turn={turn}
                showMeaning={showMeaning}
                showFurigana={showFurigana}
                covered={isCovered(i)}
                onUncover={() => setUncovered((s) => new Set(s).add(i))}
                selected={selected === i}
                playToken={play?.row === i ? play.n : null}
                voiceSpeaker={voiceSpeaker}
                speechRate={speechRate}
              />
            ))}
          </ol>
        </div>
      )}
    </PageShell>
  );
}
