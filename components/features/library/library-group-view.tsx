'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, FolderOpen, SearchX, UserRound } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { GroupKindBadge } from '@/components/common/group-kind-badge';
import { IconAction } from '@/components/common/icon-action';
import { ScrollMoreStatus } from '@/components/common/scroll-more-status';
import { SearchInput } from '@/components/common/search-input';
import { useScrollMore } from '@/components/common/use-scroll-more';
import { useServerAction } from '@/components/common/use-server-action';
import {
  LibraryEntryCard,
  ORIGIN_LABEL,
  type LibraryEntryRow,
} from '@/components/features/library/library-entry-card';
import { HaveBar, haveText } from '@/components/features/library/have-bar';
import { LibraryAdminMenu } from '@/components/features/library/library-admin-menu';
import { takeGroupAction } from '@/app/library/actions';
import { LikeButton } from '@/components/features/library/like-button';
import { isGroupKind } from '@/lib/library/group-kinds';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';

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
  /** The admin gets Ẩn on the group, in its menu (L6); an entry's is on its own page. */
  admin?: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
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
  const { items, hasMore, sentinelRef } = useScrollMore(found, needle);

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
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm trong nhóm…"
                  aria-label="Tìm trong nhóm"
                  className="flex-1 sm:w-64 sm:flex-none"
                />
                {/* Kept out of the header, which its loading screen draws the same for everyone. */}
                {admin && <LibraryAdminMenu entryId={group.id} name={group.name} back="/library" />}
              </div>
            </div>
            {found.length === 0 ? (
              <EmptyState icon={SearchX} title="Không có mục nào khớp trong nhóm này." />
            ) : (
              <div className="@container">
                <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
                  {items.map((e) => (
                    <LibraryEntryCard
                      key={e.id}
                      entry={e}
                      showFurigana={showFurigana}
                      voiceSpeaker={voiceSpeaker}
                      speechRate={speechRate}
                    />
                  ))}
                </ul>
              </div>
            )}
            <ScrollMoreStatus ref={sentinelRef} hasMore={hasMore} />
          </>
        )}
      </div>
    </PageShell>
  );
}
