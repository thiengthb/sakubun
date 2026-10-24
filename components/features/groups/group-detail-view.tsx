'use client';

import { useMemo, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { Layers, Lightbulb, SearchX, X } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { AppBreadcrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/common/explain';
import { DataPagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/common/empty-state';
import { usePagedList } from '@/components/common/use-paged-list';
import { useSessionState } from '@/components/common/use-session-state';
import { SearchInput } from '@/components/common/search-input';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import { GroupAddItemsAction, GroupEditAction } from '@/components/features/groups/group-actions';
import { GroupCards } from '@/components/features/groups/group-cards';
import { SpokenLine } from '@/components/common/spoken-line';
import { ItemDetailDialog } from '@/components/common/item-detail-dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TabSelect } from '@/components/common/tab-select';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';
import { speakable } from '@/lib/core/format';
import { removeItemsFromGroupAction } from '@/app/actions';
import type { GroupDetail, GroupMemberItem } from '@/lib/library/groups';
import type { QuickCard } from '@/lib/app/quick-review';
import { cn } from '@/lib/core/utils';

const cardCls = 'rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10';

const GROUP_TABS = [
  { value: 'list', label: 'Danh sách' },
  { value: 'flashcard', label: 'Flashcard' },
] as const;

const detailKind = (kind: string): 'grammar' | 'vocab' => (kind === 'VOCAB' ? 'vocab' : 'grammar');

export function GroupDetailView({
  group,
  addable,
  cards,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  group: GroupDetail;
  addable: GroupMemberItem[];
  cards: QuickCard[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const [tab, setTab] = useSessionState('group.tab', 'list');
  const [isPending, startTransition] = useTransition();
  const [memberQuery, setMemberQuery] = useSessionState(`group.${group.id}.memberQ`, '');
  const mixed = group.kind === 'mixed';

  const visibleMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return group.members;
    return group.members.filter((m) =>
      [m.expression, m.reading, m.meaningVi].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [group.members, memberQuery]);

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
      toast.success('Đã chép — dán vào Claude Desktop hoặc ChatGPT', { description: command });
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
          <TabSelect items={GROUP_TABS} value={tab} onValueChange={setTab} label="Chọn khung xem" />
        }
      >
        <TabsContent value="list" className="space-y-6">
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
              <Explain
                text={
                  <>
                    Bấm để chép lệnh <b>“luyện nhóm {group.name}”</b> — dán vào Claude Desktop hoặc
                    ChatGPT để luyện đúng batch của nhóm này.
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
              <div ref={listRef} className={cn(cardCls, 'divide-y divide-border')}>
                {pagedMembers.items.map((m) => (
                  <div key={m.itemId} className="flex h-16 items-center gap-2 px-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <SpokenLine
                            truncate
                            className="leading-[1.9]"
                            text={m.expression}
                            speakText={speakable(m.expression)}
                            ruby={buildFuriganaMarkup(m.expression, m.reading)}
                            showFurigana={showFurigana}
                            speaker={voiceSpeaker}
                            rate={speechRate}
                            label="Nghe"
                          />
                        </span>
                        {mixed && (
                          <span className="shrink-0 text-xs tracking-wide text-muted-foreground uppercase">
                            {m.kind === 'VOCAB' ? 'từ' : 'ngữ pháp'}
                          </span>
                        )}
                      </div>
                      {m.meaningVi && (
                        <div className="truncate text-subhead text-muted-foreground">
                          {m.meaningVi}
                        </div>
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
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Gỡ ${m.expression} khỏi nhóm`}
                      title="Gỡ khỏi nhóm"
                      onClick={() => remove(m.itemId)}
                      disabled={isPending}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
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
          <GroupCards
            key={cards.map((c) => c.itemId).join(',')}
            cards={cards}
            showFurigana={showFurigana}
            tts={{ voiceSpeaker, speechRate }}
          />
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
