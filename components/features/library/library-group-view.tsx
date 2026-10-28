'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, EyeOff, FolderOpen, MoreHorizontal, SearchX, UserRound } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/common/empty-state';
import { GroupKindBadge } from '@/components/common/group-kind-badge';
import { IconAction } from '@/components/common/icon-action';
import { SearchInput } from '@/components/common/search-input';
import { useServerAction } from '@/components/common/use-server-action';
import {
  LibraryEntryCard,
  ORIGIN_LABEL,
  type LibraryEntryRow,
} from '@/components/features/library/library-entry-card';
import { HaveBar, haveText } from '@/components/features/library/have-bar';
import { takeGroupAction } from '@/app/library/actions';
import { setEntryRemovedAction } from '@/app/admin/actions';
import { LikeButton } from '@/components/features/library/like-button';
import { isGroupKind } from '@/lib/library/group-kinds';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';

const PAGE = 60;

// One shared group (phase 8, L2; 7.4h): what is in it, how much of it the learner has, and "Lấy cả
// nhóm", which copies the items the learner lacks and makes the group theirs. Once taken, the action
// opens their own group, and "Lấy phần còn thiếu" fills it again. A search finds an entry in it.
export function LibraryGroupView({
  group,
  entries,
  admin = false,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  group: {
    id: string;
    name: string;
    groupKind: string | null;
    notes: string | null;
    origin: string;
    author: string | null;
    takeCount: number;
    likes: number;
    liked: boolean;
    myGroupId: string | null;
  };
  entries: LibraryEntryRow[];
  /** The admin gets Ẩn on the group (in its menu) and on each entry (L6). */
  admin?: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const [shown, setShown] = useState(PAGE);
  const [q, setQ] = useState('');
  const take = useServerAction(takeGroupAction, {
    success: (r) =>
      r.added > 0
        ? `Đã lấy nhóm, thêm ${r.added} mục mới vào kho`
        : 'Đã lấy nhóm, mọi mục đều có sẵn trong kho',
  });
  const have = entries.filter((e) => e.itemId).length;
  const needle = q.trim().toLowerCase();
  const found = needle
    ? entries.filter((e) =>
        [e.expression, e.reading, e.meaningVi].some((t) => t?.toLowerCase().includes(needle)),
      )
    : entries;

  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="library" self />}
      title={group.name}
      meta={
        // The kind is a chip, first (docs/ui-standard.md › Đầu trang); then size, who shared it, note.
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {group.groupKind && isGroupKind(group.groupKind) && (
            <GroupKindBadge kind={group.groupKind} />
          )}
          <span>{entries.length} mục</span>
          <span aria-hidden>·</span>
          {group.origin === 'LEARNER' ? (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-4" aria-hidden />
              {group.author ?? 'Người dùng đã xoá'}
            </span>
          ) : (
            <span>{ORIGIN_LABEL[group.origin] ?? group.origin}</span>
          )}
          {group.takeCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{group.takeCount} lượt lấy</span>
            </>
          )}
          {group.notes && (
            <>
              <span aria-hidden>·</span>
              <span className="min-w-0 break-words">{group.notes}</span>
            </>
          )}
        </span>
      }
      pageIcons={
        <LikeButton entryId={group.id} liked={group.liked} likes={group.likes} name={group.name} />
      }
      actions={
        group.myGroupId ? (
          <ExpandingIconButton asChild icon={FolderOpen} label="Nhóm của bạn">
            <Link href={`/groups/${group.myGroupId}`} />
          </ExpandingIconButton>
        ) : (
          <Button onClick={() => take.run(group.id)} disabled={take.isPending}>
            <Download aria-hidden />
            Lấy cả nhóm
          </Button>
        )
      }
      actionsOnPhone="split"
    >
      <div className="space-y-4">
        {entries.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Nhóm này chưa có mục nào" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div data-slot="group-have" className="flex min-w-48 flex-1 items-center gap-3">
                <HaveBar have={have} size={entries.length} label={group.name} className="flex-1" />
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {haveText(have, entries.length)}
                </span>
                {group.myGroupId && have < entries.length && (
                  <IconAction
                    icon={Download}
                    label="Lấy phần còn thiếu"
                    variant="outline"
                    onClick={() => take.run(group.id)}
                    disabled={take.isPending}
                  />
                )}
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <SearchInput
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setShown(PAGE);
                  }}
                  placeholder="Tìm trong nhóm…"
                  aria-label="Tìm trong nhóm"
                  className="flex-1 sm:w-64 sm:flex-none"
                />
                {/* Kept out of the header, which its loading screen draws the same for everyone. */}
                {admin && <AdminMenu entryId={group.id} name={group.name} />}
              </div>
            </div>
            {found.length === 0 ? (
              <EmptyState icon={SearchX} title="Không có mục nào khớp trong nhóm này." />
            ) : (
              <div className="@container">
                <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
                  {found.slice(0, shown).map((e) => (
                    <LibraryEntryCard
                      key={e.id}
                      entry={e}
                      admin={admin}
                      showFurigana={showFurigana}
                      voiceSpeaker={voiceSpeaker}
                      speechRate={speechRate}
                    />
                  ))}
                </ul>
              </div>
            )}
            {shown < found.length && (
              <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                Xem thêm {Math.min(PAGE, found.length - shown)} mục
              </Button>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

// The admin's tools for a shared group (L6), behind one menu, away from Thích so Ẩn is never one
// stray click away: it takes the group off Kho chung for everyone, and the page goes back to the list.
function AdminMenu({ entryId, name }: { entryId: string; name: string }) {
  const router = useRouter();
  const hide = useServerAction(setEntryRemovedAction, {
    success: 'Đã ẩn khỏi Kho chung',
    onSuccess: () => router.push('/library'),
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Quản trị ${name}`}
          disabled={hide.isPending}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onSelect={() => hide.run(entryId, true)}>
          <EyeOff aria-hidden />
          Ẩn khỏi Kho chung
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
