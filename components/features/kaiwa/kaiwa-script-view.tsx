'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, MessagesSquare, Pencil, Trash2 } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { useServerAction } from '@/components/common/use-server-action';
import { KaiwaLine } from '@/components/features/kaiwa/kaiwa-line';
import { useLocalState } from '@/components/common/use-session-state';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { chooseMe, layoutTurns, scriptSpeakers } from '@/lib/kaiwa/layout';
import { editScriptCommand } from '@/components/features/kaiwa/kaiwa-commands';
import { deleteScriptAction } from '@/app/kaiwa/actions';
import type { RubyLine } from '@/components/features/kaiwa/kaiwa-line';

// One script (phase 8, K3): its lines as a chat seen from the part the learner picks ("Tôi là"),
// each with the Japanese to listen to and the Vietnamese, which the learner can hide to test
// themselves. Changes go through Claude ("Sửa với AI"), so the page has no editor yet.
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
  const [confirming, setConfirming] = useState(false);
  const remove = useServerAction(deleteScriptAction, {
    success: 'Đã xoá kịch bản',
    onSuccess: () => router.push('/kaiwa'),
  });
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
          <Button variant="outline" onClick={() => setShowMeaning((v) => !v)}>
            {showMeaning ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {showMeaning ? 'Ẩn nghĩa' : 'Hiện nghĩa'}
          </Button>
          <CopyCommandButton
            command={editScriptCommand(script.title)}
            label="Sửa với AI"
            size="default"
            icon={Pencil}
          />
          <Button variant="outline" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            Xoá
          </Button>
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
                showMeaning={showMeaning}
                showFurigana={showFurigana}
                voiceSpeaker={voiceSpeaker}
                speechRate={speechRate}
              />
            ))}
          </ol>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Xoá kịch bản này?"
        description={`"${script.title}" sẽ mất hẳn, không lấy lại được.`}
        confirmLabel="Xoá"
        pending={remove.isPending}
        onConfirm={() => remove.run(script.id)}
      />
    </PageShell>
  );
}
