'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, Globe, SearchX, Sparkles } from 'lucide-react';
import { AddButton } from '@/components/common/add-button';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { EmptyState } from '@/components/common/empty-state';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { SearchInput } from '@/components/common/search-input';
import { Truncate } from '@/components/ui/truncate';
import { WRITE_SCRIPT_COMMAND } from '@/lib/kaiwa/commands';
import type { KaiwaListCard } from '@/components/features/kaiwa/kaiwa-list-view';
import { cn } from '@/lib/core/utils';

// Where a wide screen starts (thien, 2026-11-07): from here Hội thoại opens the last script read and
// lists every script in one column on the right. Below it the list page stays as it was.
export const KAIWA_WIDE = '(min-width: 1280px)';
// The script this browser opened last, which /kaiwa opens on a wide screen.
export const LAST_SCRIPT_KEY = 'sakubun.local:kaiwa-last';

// The learner's scripts in one long column beside the one being read: the open one marked, a search
// by name, and the list page's actions (Kho chung, Soạn với AI, Thêm) on top.
export function KaiwaSideList({
  scripts,
  currentId,
}: {
  scripts: KaiwaListCard[];
  currentId: string;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? scripts.filter((s) => s.title.toLowerCase().includes(needle)) : scripts;

  return (
    <nav
      aria-label="Danh sách hội thoại"
      data-slot="kaiwa-side-list"
      className="flex h-full flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{scripts.length} kịch bản</span>
        <div className="flex items-center gap-1">
          <ExpandingIconButton href="/library?tab=scripts" icon={Globe} label="Kho chung" />
          <CopyCommandButton
            command={WRITE_SCRIPT_COMMAND}
            label="Soạn với AI"
            size="default"
            expandOnHover
            icon={Sparkles}
          />
          <AddButton href="/kaiwa/new" />
        </div>
      </div>
      <SearchInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo tên…"
        aria-label="Tìm bài theo tên"
        className="sm:max-w-none"
      />
      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="Không có kịch bản nào khớp tên này." />
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1 pb-4">
          {shown.map((script) => {
            const current = script.id === currentId;
            return (
              <li key={script.id}>
                <Link
                  href={`/kaiwa/${script.id}`}
                  aria-current={current ? 'page' : undefined}
                  data-slot="kaiwa-side-item"
                  className={cn(
                    'flex min-w-0 flex-col gap-0.5 rounded-md px-3 py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
                    current && 'bg-accent-brand/10 hover:bg-accent-brand/15',
                  )}
                >
                  <Truncate className={cn('text-sm', current && 'font-medium text-accent-brand')}>
                    {script.title}
                  </Truncate>
                  <Truncate className="text-xs text-muted-foreground">
                    {script.firstLine ? (
                      <span lang="ja">{script.firstLine}</span>
                    ) : (
                      'Chưa có câu nào'
                    )}
                  </Truncate>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{script.lineCount} câu</span>
                    {script.sharedEntryId ? (
                      <span className="inline-flex items-center gap-1 text-accent-brand">
                        <Globe className="size-4" aria-hidden />
                        Đang chia sẻ
                      </span>
                    ) : (
                      script.taken && (
                        <span className="inline-flex items-center gap-1">
                          <Download className="size-4" aria-hidden />
                          Từ Kho chung
                        </span>
                      )
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
