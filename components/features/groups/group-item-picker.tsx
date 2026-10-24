'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, SearchX } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataPagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/common/empty-state';
import { PageShell } from '@/components/layout/page-shell';
import { SearchInput } from '@/components/common/search-input';
import { SpokenLine } from '@/components/common/spoken-line';
import { addItemsToGroupAction } from '@/app/actions';
import { cn } from '@/lib/core/utils';
import { speakable } from '@/lib/core/format';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import type { GroupDetail, GroupMemberItem } from '@/lib/library/groups';

// A phone shows about this many rows above the action bar; more pages beat one 500-row scroll.
const PAGE_SIZE = 20;

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
    <span className="min-w-0 flex-1 space-y-0.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1">
          <SpokenLine
            truncate
            className="leading-[1.9]"
            text={item.expression}
            speakText={speakable(item.expression)}
            ruby={buildFuriganaMarkup(item.expression, item.reading)}
            showFurigana={showFurigana}
            speaker={voiceSpeaker}
            rate={speechRate}
            label="Nghe"
          />
        </span>
        {mixed && (
          <span className="shrink-0 text-xs tracking-wide text-muted-foreground uppercase">
            {item.kind === 'VOCAB' ? 'từ' : 'ngữ pháp'}
          </span>
        )}
      </span>
      {item.meaningVi && (
        <span className="block truncate text-subhead text-muted-foreground">{item.meaningVi}</span>
      )}
    </span>
  );
}

export function GroupItemPickerBody({
  group,
  addable,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
  layout = 'page',
  onDone,
  onCancel,
}: {
  group: GroupDetail;
  addable: GroupMemberItem[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
  layout?: 'page' | 'dialog';
  onDone: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const mixed = group.kind === 'mixed';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return addable;
    return addable.filter((i) =>
      [i.expression, i.reading, i.meaningVi].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [addable, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    if (sel.size === 0) return;
    startTransition(async () => {
      const r = await addItemsToGroupAction(group.id, [...sel]);
      if (toastResult(r, (d) => `Đã thêm ${d.added} mục`)) onDone();
    });
  };

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-4',
        layout === 'page' && 'sm:min-h-[calc(100svh-13rem)]',
        layout === 'dialog' && 'min-h-0 flex-1',
      )}
    >
      {layout === 'page' && (
        <p className="text-muted-foreground">
          Thêm vào <span className="font-medium text-foreground">{group.name}</span>. Chỉ hiện{' '}
          {mixed ? 'ngữ pháp và từ vựng' : GROUP_KIND_LABELS[group.kind].toLowerCase()} chưa thuộc
          nhóm.
        </p>
      )}

      {addable.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Không còn mục nào để thêm"
          description={
            mixed
              ? 'Mọi mẫu và từ trong kho đã ở trong nhóm này.'
              : `Mọi mục thuộc loại ${GROUP_KIND_LABELS[group.kind].toLowerCase()} đã ở trong nhóm này.`
          }
          action={
            <Button variant="outline" onClick={onCancel}>
              {layout === 'dialog' ? 'Đóng' : 'Quay lại nhóm'}
            </Button>
          }
        />
      ) : (
        <Card
          className={cn(
            'gap-3',
            layout === 'dialog' && 'min-h-0 flex-1 overflow-hidden',
            // The sticky action bar needs a card that does not clip it.
            layout === 'page' && 'overflow-visible',
          )}
        >
          <CardContent className="flex flex-row items-center gap-2 sm:gap-3">
            <SearchInput
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo mẫu, cách đọc hoặc nghĩa…"
              className="min-w-0 flex-1 sm:max-w-xs"
            />
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {filtered.length}/{addable.length}
            </span>
          </CardContent>

          {filtered.length === 0 ? (
            <EmptyState icon={SearchX} title="Không khớp từ khoá." className="py-8" />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto border-y border-border">
              <ul className="divide-y divide-border">
                {shown.map((i) => (
                  <li key={i.itemId}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                      <Checkbox
                        className="shrink-0"
                        checked={sel.has(i.itemId)}
                        onCheckedChange={() => toggle(i.itemId)}
                        aria-label={`Chọn ${i.expression}`}
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
            </div>
          )}
          <DataPagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            className="px-4"
          />

          <CardContent
            className={cn(
              'flex items-center gap-2',
              // On a phone the list runs past the fold: keep the add button in reach.
              layout === 'page' &&
                'sticky bottom-0 z-10 rounded-b-xl bg-card py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
            )}
          >
            <span className="text-sm text-muted-foreground tabular-nums">Đã chọn {sel.size}</span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isPending}>
                Huỷ
              </Button>
              <Button onClick={submit} disabled={isPending || sel.size === 0}>
                <Plus className="size-4" aria-hidden />
                Thêm {sel.size > 0 ? sel.size : ''} mục
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function GroupItemPicker(props: {
  group: GroupDetail;
  addable: GroupMemberItem[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const router = useRouter();
  return (
    <PageShell section="groups" action="addItems" width="narrow">
      <GroupItemPickerBody
        {...props}
        layout="page"
        onDone={() => {
          router.push(`/groups/${props.group.id}`);
          router.refresh();
        }}
        onCancel={() => router.back()}
      />
    </PageShell>
  );
}
