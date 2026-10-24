'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import { Layers, SearchX, Trash2 } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { Button } from '@/components/ui/button';
import { PagedFooter } from '@/components/common/paged-footer';
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
import { usePagedList } from '@/components/common/use-paged-list';
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

const cardCls =
  'relative flex flex-col gap-1.5 rounded-lg border border-border/70 p-3 transition-colors hover:bg-muted/40 [&_button]:relative [&_button]:z-10';

export function GroupsView({ groups }: { groups: GroupSummary[] }) {
  const [deleting, setDeleting] = useState<GroupSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useSessionState('groups.search', '', 'gq');
  const [kindFilter, setKindFilter] = useSessionState('groups.kind', 'all', 'gk');
  const [member, setMember] = useSessionState('groups.member', 'all', 'gm');
  const [sort, setSort] = useSessionState<SortKey>('groups.sort', 'recent', 'gs');
  const listRef = useRef<HTMLUListElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

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

  const paged = usePagedList(filtered, {
    topRef: listRef,
    footerRef,
    storeKey: 'groups',
    rowHeight: 130,
  });

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
        <EmptyState
          icon={SearchX}
          title="Không có nhóm nào khớp tìm kiếm / bộ lọc."
          className="py-12"
        />
      ) : (
        <>
          <ul ref={listRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paged.items.map((g) => (
              <li key={g.id} className={cardCls}>
                <Link
                  href={`/groups/${g.id}`}
                  className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="sr-only">Mở nhóm {g.name}</span>
                </Link>

                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 flex-1 items-start gap-2 font-medium">
                    <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
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

                {g.note && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{g.note}</p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-muted-foreground">
                  <span>{g.memberCount} mục</span>
                  <span aria-hidden>·</span>
                  <GroupKindBadge kind={g.kind} className="px-1.5 py-0 font-normal" />
                </div>
              </li>
            ))}
          </ul>
          <PagedFooter
            paged={paged}
            footerRef={footerRef}
            noun="nhóm"
            totalUnfiltered={groups.length}
          />
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
