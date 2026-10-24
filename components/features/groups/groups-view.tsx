'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Layers, SearchX, Trash2 } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import {
  chipFor,
  FilterChips,
  FilterPopover,
  SelectFilterRow,
  type FilterChip,
  type FilterOption,
} from '@/components/common/filter-popover';
import { GroupEditAction } from '@/components/features/groups/group-actions';
import { GroupKindBadge } from '@/components/features/groups/group-kind-badge';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import { SearchInput } from '@/components/common/search-input';
import { useScrollMore } from '@/components/common/use-scroll-more';
import { LIST_CARD } from '@/components/common/list-card';
import { ScrollMoreStatus } from '@/components/common/scroll-more-status';
import { cn } from '@/lib/core/utils';
import { useSessionState } from '@/components/common/use-session-state';
import { deleteGroupAction } from '@/app/actions';
import type { GroupSummary } from '@/lib/library/groups';

const SORTS = [
  { value: 'recent', label: 'Mới nhất' },
  { value: 'name', label: 'Tên A → Z' },
  { value: 'most', label: 'Nhiều mục nhất' },
] as const;
type SortKey = (typeof SORTS)[number]['value'];

const KIND_FILTERS: readonly FilterOption[] = [
  { value: 'all', label: 'Mọi loại' },
  ...Object.entries(GROUP_KIND_LABELS).map(([value, label]) => ({ value, label })),
];

const MEMBER_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'nonempty', label: 'Có mục' },
  { value: 'empty', label: 'Trống' },
] as const;

export function GroupsView({ groups }: { groups: GroupSummary[] }) {
  const [deleting, setDeleting] = useState<GroupSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useSessionState('groups.search', '', 'gq');
  const [kindFilter, setKindFilter] = useSessionState('groups.kind', 'all', 'gk');
  const [member, setMember] = useSessionState('groups.member', 'all', 'gm');
  const [sort, setSort] = useSessionState<SortKey>('groups.sort', 'recent', 'gs');

  const needle = q.trim().toLowerCase();
  const filterCount = (kindFilter !== 'all' ? 1 : 0) + (member !== 'all' ? 1 : 0);
  const resetFilters = () => {
    setKindFilter('all');
    setMember('all');
    setSort('recent');
  };
  // Sort is not a chip: reordering is visible in the list itself, narrowing is not.
  const chips: FilterChip[] = [
    chipFor('kind', 'Loại', kindFilter, KIND_FILTERS, () => setKindFilter('all')),
    chipFor('member', 'Số mục', member, MEMBER_FILTERS, () => setMember('all')),
  ].filter((c) => c !== null);
  const filtered = useMemo(() => {
    const rows = groups.filter(
      (g) =>
        (kindFilter === 'all' || g.kind === kindFilter) &&
        (member === 'all' || (member === 'empty' ? g.memberCount === 0 : g.memberCount > 0)) &&
        (!needle ||
          g.name.toLowerCase().includes(needle) ||
          (g.note?.toLowerCase().includes(needle) ?? false)),
    );
    const sorted = [...rows];
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    else if (sort === 'most') sorted.sort((a, b) => b.memberCount - a.memberCount);
    else sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted;
  }, [groups, kindFilter, member, sort, needle]);

  // Groups are cards at every width, so they load more as they scroll and never page.
  const {
    items: shownGroups,
    hasMore,
    sentinelRef,
  } = useScrollMore(filtered, JSON.stringify([needle, kindFilter, member, sort]));

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const r = await deleteGroupAction(deleting.id);
      if (toastResult(r, 'Đã xoá nhóm')) setDeleting(null);
    });
  };

  return (
    <div className="space-y-6">
      {groups.length > 0 && (
        <div className="flex flex-row items-center gap-2 sm:gap-3">
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm nhóm theo tên / ghi chú"
            className="min-w-0 flex-1 sm:max-w-xs"
          />
          <div className="flex shrink-0 items-center gap-2 md:ml-auto">
            <FilterPopover activeCount={filterCount} onReset={resetFilters}>
              <SelectFilterRow
                label="Loại"
                value={kindFilter}
                onValueChange={setKindFilter}
                options={KIND_FILTERS}
              />
              <SelectFilterRow
                label="Số mục"
                value={member}
                onValueChange={setMember}
                options={MEMBER_FILTERS}
              />
              <SelectFilterRow
                className="col-span-2"
                label="Sắp xếp"
                value={sort}
                onValueChange={(v) => setSort(v as SortKey)}
                options={SORTS}
              />
            </FilterPopover>
          </div>
        </div>
      )}

      {groups.length > 0 && <FilterChips chips={chips} onReset={resetFilters} className="-mt-3" />}

      {groups.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Chưa có nhóm nào"
          description="Bấm Thêm để gom các mục muốn luyện chung."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Không có nhóm nào khớp tìm kiếm / bộ lọc." />
      ) : (
        <>
          <div className="@container">
            <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
              {shownGroups.map((g) => (
                <li
                  key={g.id}
                  className={cn(LIST_CARD.base, LIST_CARD.linked, 'flex flex-col gap-1.5')}
                >
                  <Link href={`/groups/${g.id}`} className={LIST_CARD.link}>
                    <span className="sr-only">Mở nhóm {g.name}</span>
                  </Link>

                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 flex-1 items-start gap-2 font-medium">
                      <Layers
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="line-clamp-2">{g.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <GroupEditAction group={g} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleting(g)}
                        aria-label={`Xoá nhóm ${g.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  </div>

                  {g.note && <p className="line-clamp-2 text-sm text-muted-foreground">{g.note}</p>}

                  <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-muted-foreground">
                    <span>{g.memberCount} mục</span>
                    <span aria-hidden>·</span>
                    <GroupKindBadge kind={g.kind} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <ScrollMoreStatus ref={sentinelRef} hasMore={hasMore} total={`${filtered.length} nhóm`} />
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={<>Xoá nhóm “{deleting?.name}”?</>}
        description="Chỉ xoá nhóm và liên kết thành viên. Các mục học (ngữ pháp / từ vựng) và lịch ôn KHÔNG bị ảnh hưởng."
        confirmLabel="Xoá"
        onConfirm={confirmDelete}
        pending={isPending}
      />
    </div>
  );
}
