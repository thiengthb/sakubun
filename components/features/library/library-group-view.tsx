'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, FolderOpen } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { useServerAction } from '@/components/common/use-server-action';
import {
  LibraryEntryCard,
  ORIGIN_LABEL,
  type LibraryEntryRow,
} from '@/components/features/library/library-entry-card';
import { takeGroupAction } from '@/app/library/actions';
import { RemoveEntryButton } from '@/components/common/remove-entry-button';
import { LikeButton } from '@/components/features/library/like-button';
import { GROUP_KIND_LABELS, isGroupKind } from '@/lib/library/group-kinds';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';

const PAGE = 60;

// One shared group (phase 8, L2): what is in it, and "Lấy cả nhóm", which copies the items the
// learner lacks and makes the group theirs. Once taken, the action opens their own group.
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
    takeCount: number;
    likes: number;
    liked: boolean;
    myGroupId: string | null;
  };
  entries: LibraryEntryRow[];
  /** The admin gets Ẩn on the group and each entry (L6). */
  admin?: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const [shown, setShown] = useState(PAGE);
  const take = useServerAction(takeGroupAction, {
    success: (r) =>
      r.added > 0
        ? `Đã lấy nhóm, thêm ${r.added} mục mới vào kho`
        : 'Đã lấy nhóm, mọi mục đều có sẵn trong kho',
  });
  const have = entries.filter((e) => e.itemId).length;

  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="library" self />}
      title={group.name}
      meta={[
        group.groupKind && isGroupKind(group.groupKind) && GROUP_KIND_LABELS[group.groupKind],
        `${entries.length} mục`,
        ORIGIN_LABEL[group.origin] ?? group.origin,
        have > 0 && `Đã có ${have}`,
      ]
        .filter(Boolean)
        .join(' · ')}
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
    >
      <div className="space-y-4">
        {/* Kept out of the header so the phone header stays one row, as its skeleton draws it. */}
        {admin && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Quản trị</span>
            <RemoveEntryButton entryId={group.id} name={group.name} />
          </div>
        )}
        {group.notes && <p className="text-muted-foreground">{group.notes}</p>}
        {entries.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Nhóm này chưa có mục nào" />
        ) : (
          <>
            <div className="@container">
              <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
                {entries.slice(0, shown).map((e) => (
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
            {shown < entries.length && (
              <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                Xem thêm {Math.min(PAGE, entries.length - shown)} mục
              </Button>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
