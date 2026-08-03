'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import { Layers, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { Button } from '@/components/ui/button';
import { DataPagination } from '@/components/ui/data-pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { FilterPopover, FilterRow } from '@/components/shared/filter-popover';
import { GroupForm } from '@/components/groups/group-form';
import { GROUP_KIND_LABELS, GroupKindBadge } from '@/components/groups/group-kind-badge';
import { SearchInput } from '@/components/shared/search-input';
import { usePagedList } from '@/components/shared/use-paged-list';
import { useSessionState } from '@/components/shared/use-session-state';
import { deleteGroupAction } from '@/app/actions';
import type { GroupSummary } from '@/lib/groups';

const SORTS = [
  { value: 'recent', label: 'Mới nhất' },
  { value: 'name', label: 'Tên A → Z' },
  { value: 'most', label: 'Nhiều mục nhất' },
] as const;
type SortKey = (typeof SORTS)[number]['value'];

const MEMBER_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'nonempty', label: 'Có mục' },
  { value: 'empty', label: 'Trống' },
] as const;

// The app styles cards with a ring (not a border) + --card-spacing; a plain div with these classes
// avoids the Card component's built-in vertical padding for this custom, denser card layout.
const cardCls = 'rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10';

/**
 * Body of the "Nhóm" tab on the /resources page (was the standalone /groups page). The breadcrumb +
 * tab row above names the section, so this renders just the create action + the group cards + the
 * create/edit/delete dialogs.
 */
export function GroupsView({ groups }: { groups: GroupSummary[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GroupSummary | null>(null);
  const [deleting, setDeleting] = useState<GroupSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useSessionState('groups.search', '', 'gq');
  const [kindFilter, setKindFilter] = useSessionState('groups.kind', 'all', 'gk');
  const [member, setMember] = useSessionState('groups.member', 'all', 'gm');
  const [sort, setSort] = useSessionState<SortKey>('groups.sort', 'recent', 'gs');
  // Card grid + pagination bar are measured so the page size fills the viewport (no scroll).
  const listRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const needle = q.trim().toLowerCase();
  const filterCount = (kindFilter !== 'all' ? 1 : 0) + (member !== 'all' ? 1 : 0);
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

  // Cards ~130px tall (measured once rendered); grid is 1 / 2 / 3 columns — read live from the DOM.
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
      {/* Create dialog is controlled + mounted regardless of the toolbar, so the empty-state action can
          open it even when there are no groups yet (the toolbar is hidden then — the standard: no data
          ⇒ no search / no action bar, just the empty state). */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo nhóm mới</DialogTitle>
            <DialogDescription>
              Đặt tên và chọn loại. Loại quyết định mục nào được thêm.
            </DialogDescription>
          </DialogHeader>
          <GroupForm onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Toolbar mirrors the grammar/vocab tabs: search + a filter, with the create action pushed right.
          Shown only when there ARE groups. */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm nhóm theo tên / ghi chú"
          />
          {/* Filter + create grouped on the right (sm:ml-auto), mirroring the grammar/vocab DataTable
            toolbar — the filter button sits beside "Tạo nhóm", not next to the search box. */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <FilterPopover
              activeCount={filterCount}
              onReset={() => {
                setKindFilter('all');
                setMember('all');
                setSort('recent');
              }}
            >
              <FilterRow label="Loại">
                <Select value={kindFilter} onValueChange={setKindFilter}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="all">Mọi loại</SelectItem>
                    {(Object.keys(GROUP_KIND_LABELS) as (keyof typeof GROUP_KIND_LABELS)[]).map(
                      (k) => (
                        <SelectItem key={k} value={k}>
                          {GROUP_KIND_LABELS[k]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </FilterRow>
              <FilterRow label="Số mục">
                <Select value={member} onValueChange={setMember}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {MEMBER_FILTERS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterRow>
              <div className="col-span-2">
                <FilterRow label="Sắp xếp">
                  <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {SORTS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterRow>
              </div>
            </FilterPopover>
            <ExpandingIconButton
              icon={Plus}
              label="Tạo nhóm"
              variant="default"
              onClick={() => setCreateOpen(true)}
            />
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Chưa có nhóm nào"
          description="Tạo nhóm đầu tiên để gom các mục bạn muốn luyện chung."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Tạo nhóm
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Không có nhóm nào khớp tìm kiếm / bộ lọc."
          className="py-12"
        />
      ) : (
        <>
          <div ref={listRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paged.items.map((g) => (
              <div key={g.id} className={`${cardCls} flex flex-col gap-2 p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/groups/${g.id}`}
                    className="flex items-center gap-2 font-medium hover:underline"
                  >
                    <Layers className="size-4 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2">{g.name}</span>
                  </Link>
                  <GroupKindBadge kind={g.kind} />
                </div>

                {/* Always render the description line (placeholder "__" when empty) + reserve 2 lines,
                    so a note-less card is the SAME height as one with a note — cards stay uniform. */}
                <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                  {g.note || <span className="text-muted-foreground/40">__</span>}
                </p>

                <div className="mt-auto flex items-center justify-between pt-1">
                  <Link
                    href={`/groups/${g.id}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {g.memberCount} mục
                  </Link>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setEditing(g)}
                      aria-label={`Sửa nhóm ${g.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(g)}
                      aria-label={`Xoá nhóm ${g.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            ref={footerRef}
            className="flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center"
          >
            <span className="text-xs text-muted-foreground">
              {paged.start + 1}–{Math.min(paged.start + paged.pageSize, paged.total)} /{' '}
              {paged.total} nhóm
              {paged.total !== groups.length && ` (lọc từ ${groups.length})`}
            </span>
            <DataPagination
              page={paged.page}
              pageCount={paged.pageCount}
              onPageChange={paged.setPage}
              pageSize={paged.pageSize}
              pageSizeOptions={paged.sizeOptions}
              onPageSizeChange={paged.choosePageSize}
              autoFit={paged.autoFit}
              autoFitSize={paged.autoFitSize}
              onAutoFit={paged.onAutoFit}
            />
          </div>
        </>
      )}

      {/* Edit dialog (controlled by `editing`). */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa nhóm</DialogTitle>
            <DialogDescription>Đổi tên, loại hoặc ghi chú.</DialogDescription>
          </DialogHeader>
          {editing && <GroupForm group={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirm. */}
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
