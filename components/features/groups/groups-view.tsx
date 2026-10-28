'use client';

import { useMemo, useState, useTransition } from 'react';
import { Layers, SearchX } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
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
import { GroupCard } from '@/components/features/groups/group-card';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import { SearchInput } from '@/components/common/search-input';
import { SearchToolbar } from '@/components/common/search-toolbar';
import { useScrollMore } from '@/components/common/use-scroll-more';
import { ScrollMoreStatus } from '@/components/common/scroll-more-status';
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
        <SearchToolbar
          search={
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm nhóm theo tên / ghi chú"
              className="sm:max-w-none"
            />
          }
        >
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
        </SearchToolbar>
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
                <GroupCard key={g.id} group={g} onDelete={setDeleting} />
              ))}
            </ul>
          </div>
          <ScrollMoreStatus ref={sentinelRef} hasMore={hasMore} />
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
