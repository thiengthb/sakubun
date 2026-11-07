'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Globe, MessagesSquare, SearchX, Sparkles } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { AddButton } from '@/components/common/add-button';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { EmptyState } from '@/components/common/empty-state';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { LIST_CARD } from '@/components/common/list-card';
import { RelativeTime } from '@/components/common/relative-time';
import { SearchInput } from '@/components/common/search-input';
import { Truncate } from '@/components/ui/truncate';
import { WRITE_SCRIPT_COMMAND } from '@/components/features/kaiwa/kaiwa-commands';
import { KAIWA_WIDE, LAST_SCRIPT_KEY } from '@/components/features/kaiwa/kaiwa-side-list';
import type { ScriptCard } from '@/lib/kaiwa/scripts';
import { cn } from '@/lib/core/utils';

// From this many scripts on, a search box finds one by its name (thien, 7.4g).
const SEARCH_FROM = 9;

// List template (phase 8, K3; cards 7.4g): the learner's scripts, newest first. Each card says what
// the script is about at a glance: its first spoken line, how many lines, who speaks, and when it
// changed. Scripts are mostly written with Claude over MCP (the header copies the phrase that
// starts it); "Thêm" writes one on the web (K3c). A card says when the script is shared on Kho
// chung or was taken from it, and the header opens the scripts others share (2026-11-07).
export type KaiwaListCard = ScriptCard & { sharedEntryId: string | null; taken: boolean };

// On a wide screen (thien, 2026-11-07) Hội thoại opens the script this browser read last, or the
// newest, whose page lists the rest in a column; the cards below stay for smaller screens.
function useOpenLastOnWide(scripts: KaiwaListCard[]) {
  const router = useRouter();
  useEffect(() => {
    if (scripts.length === 0 || !window.matchMedia(KAIWA_WIDE).matches) return;
    let last: string | null = null;
    try {
      last = window.localStorage.getItem(LAST_SCRIPT_KEY);
    } catch {
      // Storage off: the newest script.
    }
    const target = scripts.find((s) => s.id === last) ?? scripts[0];
    router.replace(`/kaiwa/${target.id}`);
  }, [scripts, router]);
}

export function KaiwaListView({ scripts }: { scripts: KaiwaListCard[] }) {
  useOpenLastOnWide(scripts);
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
          <ExpandingIconButton asChild icon={Globe} label="Kho chung">
            <Link href="/library?tab=scripts" />
          </ExpandingIconButton>
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
              sửa tới khi ổn, rồi Claude lưu vào đây. Muốn tự viết thì bấm Thêm. Hoặc lấy kịch bản
              người khác chia sẻ ở{' '}
              <Link href="/library?tab=scripts" className="underline underline-offset-4">
                Kho chung › Kịch bản
              </Link>
              .
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
                      {script.sharedEntryId ? (
                        <span
                          data-slot="kaiwa-card-shared"
                          className="ml-auto inline-flex shrink-0 items-center gap-1 text-accent-brand"
                        >
                          <Globe className="size-4" aria-hidden />
                          Đang chia sẻ
                        </span>
                      ) : (
                        script.taken && (
                          <span className="ml-auto inline-flex shrink-0 items-center gap-1">
                            <Download className="size-4" aria-hidden />
                            Từ Kho chung
                          </span>
                        )
                      )}
                      <span
                        className={cn(
                          'shrink-0',
                          !script.sharedEntryId && !script.taken && 'ml-auto',
                        )}
                      >
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
