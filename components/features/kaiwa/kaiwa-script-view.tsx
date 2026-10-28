'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, MessagesSquare, Pencil, Sparkles } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { KaiwaLine } from '@/components/features/kaiwa/kaiwa-line';
import { useLocalState } from '@/components/common/use-session-state';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { chooseMe, layoutTurns, scriptSpeakers } from '@/lib/kaiwa/layout';
import { editScriptCommand } from '@/components/features/kaiwa/kaiwa-commands';
import type { RubyLine } from '@/components/features/kaiwa/kaiwa-line';
import type { WordMeaning } from '@/lib/kaiwa/lookup';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';

// One script (phase 8, K3): its lines as a chat seen from the part the learner picks ("Tôi là"),
// each with the Japanese to listen to and the Vietnamese, which the learner can hide to test
// themselves. Changes go through Claude ("Sửa với AI") or the web editor ("Sửa", K3c), which also
// holds Xoá, so a phone header keeps three buttons.
export function KaiwaScriptView({
  script,
  lines,
  meanings,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  script: { id: string; title: string; updatedAt: Date };
  lines: RubyLine[];
  meanings: Record<string, WordMeaning>;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const [showMeaning, setShowMeaning] = useState(true);
  const speakers = scriptSpeakers(lines);
  // Remembered per script on this device, so the learner comes back to the same part.
  const [stored, setStored] = useLocalState<string | null>(`kaiwa-me:${script.id}`, null);
  const me = chooseMe(speakers, stored);
  const turns = layoutTurns(lines, me);

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
          <ExpandingIconButton
            icon={showMeaning ? EyeOff : Eye}
            label={showMeaning ? 'Ẩn nghĩa' : 'Hiện nghĩa'}
            onClick={() => setShowMeaning((v) => !v)}
          />
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
        </>
      }
      actionsOnPhone="split"
    >
      {lines.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="Kịch bản này chưa có câu nào" />
      ) : (
        <div className="max-w-3xl space-y-4">
          {speakers.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Tôi là</span>
              <ToggleGroup
                type="single"
                variant="choice"
                aria-label="Tôi là"
                value={me ?? ''}
                onValueChange={(value) => value && setStored(value)}
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
          <ol className="space-y-3">
            {turns.map((turn) => (
              <KaiwaLine
                key={turn.line.row}
                turn={turn}
                meanings={meanings}
                showMeaning={showMeaning}
                showFurigana={showFurigana}
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
