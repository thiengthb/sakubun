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
import { editScriptCommand } from '@/components/features/kaiwa/kaiwa-commands';
import { deleteScriptAction } from '@/app/kaiwa/actions';
import type { RubyLine } from '@/components/features/kaiwa/kaiwa-line';

// One script (phase 8, K3): its lines as cards, each with its speaker, the Japanese to listen to and
// the Vietnamese, which the learner can hide to test themselves. Changes go through Claude
// ("Sửa với AI"), so the page has no editor yet.
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
  const speakers = [...new Set(lines.map((l) => l.speaker).filter((s) => s !== null))];

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
        <ol className="space-y-2">
          {lines.map((line) => (
            <KaiwaLine
              key={line.row}
              line={line}
              side={line.speaker === null ? null : speakers.indexOf(line.speaker) % 2}
              showMeaning={showMeaning}
              showFurigana={showFurigana}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
            />
          ))}
        </ol>
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
