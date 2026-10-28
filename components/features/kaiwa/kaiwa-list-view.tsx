'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessagesSquare, SearchX, Sparkles } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { AddButton } from '@/components/common/add-button';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { EmptyState } from '@/components/common/empty-state';
import { LIST_CARD } from '@/components/common/list-card';
import { RelativeTime } from '@/components/common/relative-time';
import { SearchInput } from '@/components/common/search-input';
import { Truncate } from '@/components/ui/truncate';
import { WRITE_SCRIPT_COMMAND } from '@/components/features/kaiwa/kaiwa-commands';
import type { ScriptCard } from '@/lib/kaiwa/scripts';
import { cn } from '@/lib/core/utils';

// From this many scripts on, a search box finds one by its name (thien, 7.4g).
const SEARCH_FROM = 9;

// List template (phase 8, K3; cards 7.4g): the learner's scripts, newest first. Each card says what
// the script is about at a glance: its first spoken line, how many lines, who speaks, and when it
// changed. Scripts are mostly written with Claude over MCP (the header copies the phrase that
// starts it); "Thêm" writes one on the web (K3c).
export function KaiwaListView({ scripts }: { scripts: ScriptCard[] }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? scripts.filter((s) => s.title.toLowerCase().includes(needle)) : scripts;

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
        <div className="space-y-4">
          {scripts.length >= SEARCH_FROM && (
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên kịch bản…"
              aria-label="Tìm theo tên kịch bản"
            />
          )}
          {shown.length === 0 ? (
            <EmptyState icon={SearchX} title="Không có kịch bản nào khớp tên này." />
          ) : (
            <div className="@container">
              <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
                {shown.map((script) => (
                  <li
                    key={script.id}
                    data-slot="kaiwa-card"
                    className={cn(LIST_CARD.base, LIST_CARD.linked, 'flex min-w-0 flex-col gap-1')}
                  >
                    <Link href={`/kaiwa/${script.id}`} className={LIST_CARD.link}>
                      <span className="sr-only">Mở {script.title}</span>
                    </Link>
                    <Truncate className="font-medium">{script.title}</Truncate>
                    <Truncate className="text-sm text-muted-foreground">
                      {script.firstLine ? (
                        <span lang="ja">{script.firstLine}</span>
                      ) : (
                        'Chưa có câu nào'
                      )}
                    </Truncate>
                    <div className="mt-auto flex min-w-0 items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <span className="shrink-0">{script.lineCount} câu</span>
                      {script.speakers.length > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <Truncate className="min-w-0">
                            <span lang="ja">{script.speakers.join(' · ')}</span>
                          </Truncate>
                        </>
                      )}
                      <span className="ml-auto shrink-0">
                        <RelativeTime value={script.updatedAt} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
