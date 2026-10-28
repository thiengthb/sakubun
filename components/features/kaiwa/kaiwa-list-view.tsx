'use client';

import Link from 'next/link';
import { MessagesSquare, Sparkles } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { AddButton } from '@/components/common/add-button';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { EmptyState } from '@/components/common/empty-state';
import { LIST_CARD } from '@/components/common/list-card';
import { RelativeTime } from '@/components/common/relative-time';
import { WRITE_SCRIPT_COMMAND } from '@/components/features/kaiwa/kaiwa-commands';
import type { ScriptSummary } from '@/lib/kaiwa/scripts';
import { cn } from '@/lib/core/utils';

// List template (phase 8, K3): the learner's scripts, newest first. Scripts are mostly written with
// Claude over MCP (the header copies the phrase that starts it); "Thêm" writes one on the web (K3c).
export function KaiwaListView({ scripts }: { scripts: ScriptSummary[] }) {
  return (
    <PageShell
      template="list"
      title="Hội thoại"
      meta={`${scripts.length} kịch bản`}
      actions={
        <>
          <CopyCommandButton
            command={WRITE_SCRIPT_COMMAND}
            label="Soạn với AI"
            size="default"
            expandOnHover
            icon={Sparkles}
          />
          <AddButton href="/kaiwa/new" />
        </>
      }
      actionsOnPhone="split"
    >
      {scripts.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Chưa có kịch bản nào"
          description={
            <>
              Bấm Soạn với AI rồi dán vào Claude: Claude soạn kịch bản trên canvas của nó, hai bên
              sửa tới khi ổn, rồi Claude lưu vào đây. Muốn tự viết thì bấm Thêm.
            </>
          }
        />
      ) : (
        <div className="@container">
          <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
            {scripts.map((script) => (
              <li
                key={script.id}
                className={cn(LIST_CARD.base, LIST_CARD.linked, 'min-w-0 space-y-1')}
              >
                <Link href={`/kaiwa/${script.id}`} className={LIST_CARD.link}>
                  <span className="sr-only">Mở {script.title}</span>
                </Link>
                <p className="truncate text-sm font-bold">{script.title}</p>
                <p className="text-xs text-muted-foreground">
                  Cập nhật <RelativeTime value={script.updatedAt} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  );
}
