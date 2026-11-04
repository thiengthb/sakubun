'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, MessagesSquare, SearchX, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { LIST_CARD } from '@/components/common/list-card';
import { SearchInput } from '@/components/common/search-input';
import { Truncate } from '@/components/ui/truncate';
import { LikeButton } from '@/components/features/library/like-button';
import { searchScriptsAction } from '@/app/library/actions';
import type { LibraryScriptRow } from '@/lib/library/script-rows';
import { cn } from '@/lib/core/utils';

// How long the search box waits after the last key before it asks the server.
const SEARCH_WAIT_MS = 250;

// Kho chung's "Kịch bản" tab (K7b): the Kaiwa scripts learners shared, the most taken first,
// searched on the server by title and text. A card opens the script's page, where it is read and
// taken.
export function LibraryScripts({ scripts }: { scripts: LibraryScriptRow[] }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ needle: string; rows: LibraryScriptRow[] } | null>(null);
  const [searching, startSearch] = useTransition();
  const asked = useRef('');

  useEffect(() => {
    const needle = q.trim();
    asked.current = needle;
    if (!needle) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchScriptsAction(needle);
        if (asked.current === needle) setFound({ needle, rows });
      });
    }, SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [q]);

  if (scripts.length === 0)
    return (
      <EmptyState
        icon={MessagesSquare}
        title="Chưa có kịch bản nào được chia sẻ"
        description={
          <>
            Muốn chia sẻ kịch bản của bạn: mở nó ở{' '}
            <Link href="/kaiwa" className="underline underline-offset-2">
              Hội thoại
            </Link>{' '}
            rồi bấm Chia sẻ.
          </>
        }
      />
    );

  // The last answer, while it is for what the box says now; an empty box lists them all.
  const needle = q.trim();
  const shown = needle && found?.needle === needle ? found.rows : scripts;
  return (
    <div className="space-y-4">
      <SearchInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo tên hoặc câu trong kịch bản…"
        aria-label="Tìm kịch bản"
        aria-busy={searching}
      />
      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="Không có kịch bản nào khớp." />
      ) : (
        <div className="@container">
          <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
            {shown.map((s) => (
              <LibraryScriptCard key={s.id} script={s} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// One shared script: its title and first spoken line, then how long it is, who shared it, its
// takes and likes, as the learner's own script cards and the group cards say it.
export function LibraryScriptCard({ script }: { script: LibraryScriptRow }) {
  return (
    <li
      data-slot="library-script"
      className={cn(LIST_CARD.base, LIST_CARD.linked, 'flex min-w-0 flex-col gap-1')}
    >
      <Link href={`/library/script/${script.id}`} className={LIST_CARD.link}>
        <span className="sr-only">Mở {script.title}</span>
      </Link>

      <div className="flex items-center gap-2">
        <MessagesSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Truncate className="flex-1 font-medium">{script.title}</Truncate>
        {script.myScriptId && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ok">
            <Check className="size-4" aria-hidden />
            Đã có
          </span>
        )}
      </div>

      <Truncate className="text-sm text-muted-foreground">
        {script.firstLine ? <span lang="ja">{script.firstLine}</span> : 'Chưa có câu nào'}
      </Truncate>

      <div className="mt-auto flex min-w-0 items-center gap-2 pt-1 text-xs text-muted-foreground">
        <span className="shrink-0">{script.lineCount} câu</span>
        {script.speakers.length > 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="shrink-0">{script.speakers.length} vai</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span className="flex min-w-0 items-center gap-1">
          <UserRound className="size-4 shrink-0" aria-hidden />
          <Truncate>{script.author ?? 'Người dùng đã xoá'}</Truncate>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {script.takeCount > 0 && <span>{script.takeCount} lượt lấy</span>}
          <LikeButton
            entryId={script.id}
            liked={script.liked}
            likes={script.likes}
            name={script.title}
          />
        </span>
      </div>
    </li>
  );
}
