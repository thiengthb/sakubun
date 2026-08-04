'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Layers, Lightbulb, Pencil, Plus, SearchX } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { AppBreadcrumbs } from '@/components/shell/app-breadcrumbs';
import { PageShell } from '@/components/shell/page-shell';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/shared/explain';
import { Checkbox } from '@/components/ui/checkbox';
import { DataPagination } from '@/components/ui/data-pagination';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { EmptyState } from '@/components/shared/empty-state';
import { usePagedList } from '@/components/shared/use-paged-list';
import { useSessionState } from '@/components/shared/use-session-state';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GroupForm } from '@/components/groups/group-form';
import { SearchInput } from '@/components/shared/search-input';
import { GROUP_KIND_LABELS } from '@/components/groups/group-kind-badge';
import { GroupFlashcards } from '@/components/groups/group-flashcards';
import { SpokenLine } from '@/components/shared/spoken-line';
import { ItemDetailDialog } from '@/components/resources/item-detail-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { speakable } from '@/lib/format';
import { addItemsToGroupAction, removeItemsFromGroupAction } from '@/app/actions';
import type { GroupDetail, GroupMemberItem } from '@/lib/groups';

const cardCls = 'rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10';

/** Map the stored uppercase Item.kind to the lowercase kind the detail dialog / labels use. */
const detailKind = (kind: string): 'grammar' | 'vocab' => (kind === 'VOCAB' ? 'vocab' : 'grammar');

/** The Japanese term as a SpokenLine (furigana + audio + karaoke — the platform playable rule). */
function Term({
  item,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  item: GroupMemberItem;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  return (
    <SpokenLine
      text={item.expression}
      speakText={speakable(item.expression)}
      ruby={buildFuriganaMarkup(item.expression, item.reading)}
      showFurigana={showFurigana}
      speaker={voiceSpeaker}
      rate={speechRate}
      label="Nghe"
    />
  );
}

/** One item row in the add picker: playable term + kind tag (mixed) + meaning. */
function PickerLine({
  item,
  mixed,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  item: GroupMemberItem;
  mixed: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <Term
          item={item}
          voiceSpeaker={voiceSpeaker}
          speechRate={speechRate}
          showFurigana={showFurigana}
        />
        {mixed && (
          <span className="shrink-0 text-xs tracking-wide text-muted-foreground uppercase">
            {item.kind === 'VOCAB' ? 'từ' : 'ngữ pháp'}
          </span>
        )}
      </div>
      {item.meaningVi && (
        <div className="truncate text-sm text-muted-foreground">{item.meaningVi}</div>
      )}
    </div>
  );
}

export function GroupDetailView({
  group,
  addable,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  group: GroupDetail;
  addable: GroupMemberItem[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  // Active tab persists across nav + reload with a SHARED key (sticky tab — open any group, land on the
  // tab you last used). editOpen/addOpen/query/sel stay ephemeral: they belong to a transient dialog or
  // a selection a returning user shouldn't inherit.
  const [tab, setTab] = useSessionState('group.tab', 'list');
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  // Member-list search persists PER GROUP (keyed by id) so returning restores it without a stale term
  // from group A filtering group B to empty.
  const [memberQuery, setMemberQuery] = useSessionState(`group.${group.id}.memberQ`, '');
  const mixed = group.kind === 'mixed';

  const visibleMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return group.members;
    return group.members.filter((m) =>
      [m.expression, m.reading, m.meaningVi].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [group.members, memberQuery]);

  // Paginate the (filtered) member list so a big group fills the viewport without a page scroll (same
  // measured auto-fit the resources tables use). It is a flat divide-y list (1 per row), not a grid.
  const listRef = useRef<HTMLDivElement>(null);
  const listFooterRef = useRef<HTMLDivElement>(null);
  const pagedMembers = usePagedList(visibleMembers, {
    topRef: listRef,
    footerRef: listFooterRef,
    storeKey: `group-${group.id}`,
    rowHeight: 64,
    grid: false,
    rowGap: 0,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return addable;
    return addable.filter((i) =>
      [i.expression, i.reading, i.meaningVi].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [addable, query]);

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submitAdd = () => {
    if (sel.size === 0) return;
    startTransition(async () => {
      const r = await addItemsToGroupAction(group.id, [...sel]);
      if (toastResult(r, (d) => `Đã thêm ${d.added} mục`)) {
        setSel(new Set());
        setQuery('');
        setAddOpen(false);
      }
    });
  };

  const remove = (itemId: string) => {
    startTransition(async () => {
      const r = await removeItemsFromGroupAction(group.id, [itemId]);
      toastResult(r, 'Đã gỡ khỏi nhóm');
    });
  };

  const copyPracticeCommand = async () => {
    const command = `luyện nhóm ${group.name}`;
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Đã chép — dán vào Claude Desktop', { description: command });
    } catch {
      toast.error('Không chép được vào clipboard', { description: command });
    }
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        breadcrumb={
          <AppBreadcrumbs
            section="resources"
            detail={{
              kind: 'groups',
              label: group.name,
              description: group.note
                ? `Nhóm: ${group.name} — ${group.note}`
                : `Nhóm: ${group.name}`,
            }}
          />
        }
        headerAside={
          <TabsList>
            <TabsTrigger value="list">Danh sách</TabsTrigger>
            <TabsTrigger value="flashcard">Flashcard</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="list" className="space-y-6">
          {/* Toolbar mirrors the resources tables: shared SearchInput on the left, actions pushed right. */}
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={memberQuery}
              onChange={(e) => {
                setMemberQuery(e.target.value);
                pagedMembers.setPage(1);
              }}
              placeholder="Tìm mẫu / từ trong nhóm…"
            />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* Idea (lightbulb): hover shows what it does; click copies the "luyện nhóm <tên>"
                  command to paste into Claude Desktop (the app can't drive Claude — MCP runs the other
                  way). Replaces the old inline hint paragraph. */}
              <Explain
                text={
                  <>
                    Bấm để chép lệnh <b>“luyện nhóm {group.name}”</b> — dán vào Claude Desktop để
                    luyện đúng batch của nhóm này. (Kết nối MCP sẽ có ở bản cập nhật sau.)
                  </>
                }
              >
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyPracticeCommand}
                  aria-label="Chép lệnh luyện nhóm này"
                >
                  <Lightbulb className="size-4" />
                </Button>
              </Explain>
              <ExpandingIconButton
                icon={Pencil}
                label="Sửa"
                variant="outline"
                onClick={() => setEditOpen(true)}
              />
              <ExpandingIconButton
                icon={Plus}
                label="Thêm mục"
                variant="default"
                onClick={() => setAddOpen(true)}
                disabled={addable.length === 0}
              />
            </div>
          </div>

          {group.members.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Nhóm chưa có mục nào"
              description={
                <>
                  Bấm “Thêm mục” để đưa{' '}
                  {mixed ? 'ngữ pháp / từ vựng' : GROUP_KIND_LABELS[group.kind]} vào nhóm này, hoặc
                  chọn nhiều mục ở trang Tài nguyên rồi “Thêm vào nhóm”.
                </>
              }
              action={
                <Button onClick={() => setAddOpen(true)} disabled={addable.length === 0}>
                  <Plus className="size-4" />
                  Thêm mục
                </Button>
              }
            />
          ) : visibleMembers.length === 0 ? (
            <EmptyState icon={SearchX} title="Không có mục nào khớp tìm kiếm." className="py-12" />
          ) : (
            <>
              <div ref={listRef} className={`${cardCls} divide-y divide-border`}>
                {pagedMembers.items.map((m) => (
                  // Fixed height (h-16) so every row is identical — the list doesn't jump when paging.
                  <div key={m.itemId} className="flex h-16 items-center gap-2 px-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <SpokenLine
                          text={m.expression}
                          speakText={speakable(m.expression)}
                          ruby={buildFuriganaMarkup(m.expression, m.reading)}
                          showFurigana={showFurigana}
                          speaker={voiceSpeaker}
                          rate={speechRate}
                          label="Nghe"
                        />
                        {mixed && (
                          <span className="shrink-0 text-xs tracking-wide text-muted-foreground uppercase">
                            {m.kind === 'VOCAB' ? 'từ' : 'ngữ pháp'}
                          </span>
                        )}
                      </div>
                      {m.meaningVi && (
                        <div className="truncate text-sm text-muted-foreground">{m.meaningVi}</div>
                      )}
                    </div>
                    <ItemDetailDialog
                      item={{
                        expression: m.expression,
                        reading: m.reading,
                        hanviet: m.hanviet,
                        meaningVi: m.meaningVi ?? '',
                        notes: m.notes ?? null,
                        level: m.level,
                        enrichment: m.enrichment,
                        suspended: m.suspended ?? false,
                        srs: m.srs ?? null,
                      }}
                      kind={detailKind(m.kind)}
                      triggerVariant="icon"
                      detailHref={`/resources/${m.itemId}`}
                      voiceSpeaker={voiceSpeaker}
                      speechRate={speechRate}
                      showFurigana={showFurigana}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(m.itemId)}
                      disabled={isPending}
                    >
                      Gỡ
                    </Button>
                  </div>
                ))}
              </div>
              {/* The count goes THROUGH DataPagination (its `count` prop), not beside it: the component
                  owns the whole footer row now, so a sibling span gets squeezed — which is exactly what
                  happened here, wrapping "1–1 / 1 mục" onto two lines. Same shape as data-table and
                  history-list. */}
              <div ref={listFooterRef}>
                <DataPagination
                  count={
                    <>
                      {pagedMembers.start + 1}–
                      {Math.min(pagedMembers.start + pagedMembers.pageSize, pagedMembers.total)} /{' '}
                      {pagedMembers.total} mục
                      {pagedMembers.total !== group.members.length &&
                        ` (lọc từ ${group.members.length})`}
                    </>
                  }
                  page={pagedMembers.page}
                  pageCount={pagedMembers.pageCount}
                  onPageChange={pagedMembers.setPage}
                  pageSize={pagedMembers.pageSize}
                  pageSizeOptions={pagedMembers.sizeOptions}
                  onPageSizeChange={pagedMembers.choosePageSize}
                  autoFit={pagedMembers.autoFit}
                  autoFitSize={pagedMembers.autoFitSize}
                  onAutoFit={pagedMembers.onAutoFit}
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="flashcard">
          <GroupFlashcards
            key={group.members.map((m) => m.itemId).join(',')}
            groupId={group.id}
            members={group.members}
            voiceSpeaker={voiceSpeaker}
            speechRate={speechRate}
            showFurigana={showFurigana}
          />
        </TabsContent>

        {/* Edit group. */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sửa nhóm</DialogTitle>
              <DialogDescription>Đổi tên, loại hoặc ghi chú.</DialogDescription>
            </DialogHeader>
            <GroupForm group={group} onDone={() => setEditOpen(false)} />
          </DialogContent>
        </Dialog>

        {/* Add items picker. */}
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) {
              setSel(new Set());
              setQuery('');
            }
          }}
        >
          <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Thêm mục vào “{group.name}”</DialogTitle>
              <DialogDescription>
                Chỉ hiện {mixed ? 'ngữ pháp và từ vựng' : GROUP_KIND_LABELS[group.kind]} chưa thuộc
                nhóm.
              </DialogDescription>
            </DialogHeader>

            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo mẫu, cách đọc hoặc nghĩa…"
              className="sm:max-w-none"
            />

            {/* Native overflow scroll (NOT Radix ScrollArea): inside a flex-col dialog capped at 85vh,
                the ScrollArea viewport's table-wrapper wouldn't take a bounded height, so the list grew
                and pushed the footer off the modal. `min-h-0 flex-1 overflow-y-auto` scrolls reliably. */}
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {addable.length === 0 ? 'Không còn mục nào để thêm.' : 'Không khớp từ khoá.'}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((i) => (
                    <li key={i.itemId}>
                      <label className="flex cursor-pointer items-center gap-3 px-1 py-2.5">
                        <Checkbox
                          className="shrink-0"
                          checked={sel.has(i.itemId)}
                          onCheckedChange={() => toggle(i.itemId)}
                        />
                        <PickerLine
                          item={i}
                          mixed={mixed}
                          voiceSpeaker={voiceSpeaker}
                          speechRate={speechRate}
                          showFurigana={showFurigana}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter className="items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">Đã chọn {sel.size}</span>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline" disabled={isPending}>
                    Huỷ
                  </Button>
                </DialogClose>
                <Button onClick={submitAdd} disabled={isPending || sel.size === 0}>
                  Thêm {sel.size > 0 ? sel.size : ''} mục
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </Tabs>
  );
}
