'use client';

import { useMemo, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { Layers, Lightbulb, SearchX } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { AppBreadcrumbs } from '@/components/shell/app-breadcrumbs';
import { PageShell } from '@/components/shell/page-shell';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/shared/explain';
import { DataPagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { usePagedList } from '@/components/shared/use-paged-list';
import { useSessionState } from '@/components/shared/use-session-state';
import { SearchInput } from '@/components/shared/search-input';
import { GROUP_KIND_LABELS } from '@/components/groups/group-kind-badge';
import { GroupAddItemsAction, GroupEditAction } from '@/components/groups/group-actions';
import { GroupFlashcards } from '@/components/groups/group-flashcards';
import { SpokenLine } from '@/components/shared/spoken-line';
import { ItemDetailDialog } from '@/components/resources/item-detail-dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TabSelect } from '@/components/shared/tab-select';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { speakable } from '@/lib/format';
import { removeItemsFromGroupAction } from '@/app/actions';
import type { GroupDetail, GroupMemberItem } from '@/lib/groups';

const cardCls = 'rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10';

const GROUP_TABS = [
  { value: 'list', label: 'Danh sách' },
  { value: 'flashcard', label: 'Flashcard' },
] as const;

/** Map the stored uppercase Item.kind to the lowercase kind the detail dialog / labels use. */
const detailKind = (kind: string): 'grammar' | 'vocab' => (kind === 'VOCAB' ? 'vocab' : 'grammar');

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
          // TabSelect, not a bare TabsList (2026-08-05). Measured at 390px: the two triggers rendered
          // x=311..489, i.e. 99px PAST the viewport, and the page scrolled sideways — this was the one
          // page-level tab bar in the app still hand-rolled, and the header row is exactly where a bar
          // costs width proportional to the number of tabs. (Unlike the item detail page, whose two tabs
          // are CONTENT tabs with a full row of their own — see item-analytics.tsx.)
          <TabSelect items={GROUP_TABS} value={tab} onValueChange={setTab} label="Chọn khung xem" />
        }
      >
        <TabsContent value="list" className="space-y-6">
          {/* Toolbar — the grammar/vocab toolbar verbatim (components/shared/data-table.tsx): ONE ROW at
              every width, the search box shrinking so the icon-only actions stay BESIDE it. It used to be
              `flex-wrap` with an uncapped input, so at 390px the three actions dropped onto a second row. */}
          <div className="flex flex-row items-center gap-2 sm:gap-3">
            <SearchInput
              value={memberQuery}
              onChange={(e) => {
                setMemberQuery(e.target.value);
                pagedMembers.setPage(1);
              }}
              placeholder="Tìm mẫu / từ trong nhóm…"
              className="min-w-0 flex-1 sm:max-w-xs"
            />
            <div className="flex shrink-0 items-center gap-2 md:ml-auto">
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
              {/* Modal from md up, route below it (2026-08-05) — see components/groups/group-actions.tsx. */}
              <GroupEditAction group={group} variant="toolbar" />
              <GroupAddItemsAction
                group={group}
                addable={addable}
                voiceSpeaker={voiceSpeaker}
                speechRate={speechRate}
                showFurigana={showFurigana}
                variant="toolbar"
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
                <GroupAddItemsAction
                  group={group}
                  addable={addable}
                  voiceSpeaker={voiceSpeaker}
                  speechRate={speechRate}
                  showFurigana={showFurigana}
                  variant="empty"
                />
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
            members={group.members}
            voiceSpeaker={voiceSpeaker}
            speechRate={speechRate}
            showFurigana={showFurigana}
          />
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
