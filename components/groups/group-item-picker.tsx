'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, SearchX } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/shared/empty-state';
import { PageShell } from '@/components/shell/page-shell';
import { SearchInput } from '@/components/shared/search-input';
import { SpokenLine } from '@/components/shared/spoken-line';
import { addItemsToGroupAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { speakable } from '@/lib/format';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { GROUP_KIND_LABELS } from '@/components/groups/group-kind-badge';
import type { GroupDetail, GroupMemberItem } from '@/lib/groups';

/** One row of the picker: playable term + kind tag (mixed groups only) + meaning. */
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
      <span className="flex flex-wrap items-center gap-2">
        <SpokenLine
          text={item.expression}
          speakText={speakable(item.expression)}
          ruby={buildFuriganaMarkup(item.expression, item.reading)}
          showFurigana={showFurigana}
          speaker={voiceSpeaker}
          rate={speechRate}
          label="Nghe"
        />
        {mixed && (
          <span className="shrink-0 text-xs tracking-wide text-muted-foreground uppercase">
            {item.kind === 'VOCAB' ? 'từ' : 'ngữ pháp'}
          </span>
        )}
      </span>
      {item.meaningVi && (
        <span className="block truncate text-sm text-muted-foreground">{item.meaningVi}</span>
      )}
    </span>
  );
}

/**
 * `/groups/<id>/add` — pick items to put into a group. Was a Dialog inside the group detail view until
 * 2026-08-05; see `GroupFormPage` for why these became routes.
 *
 * This one gained the most from the move. As a modal it was a `max-h-[85vh]` box with its own inner
 * scroller nested inside the page's scroller, and the "Thêm N mục" footer lived at the bottom of that
 * box — on a phone the list you were choosing from had perhaps 300px of height. As a page the list gets
 * the whole viewport and the action bar is `sticky` to the bottom, so the count and the button stay
 * reachable no matter how far down the list you are.
 *
 * The kind guard is server-side (`listAddableItems` only returns items the group's kind accepts, minus
 * the ones already in it), so this component never has to decide what may join.
 */
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
  /**
   * `page` — the route host (/groups/<id>/add): the list runs as long as it likes and the action bar is
   * `sticky` to the bottom of the viewport.
   * `dialog` — the desktop modal host: the list gets its own bounded scroller (a dialog cannot grow past
   * the viewport) and the action bar is a plain row at the end of it.
   * The two hosts share this ONE body so the kind guard, the selection model and the submit path cannot
   * drift between the phone and the desktop.
   */
  layout?: 'page' | 'dialog';
  onDone: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
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
        // Page host: fill what is left of the viewport so the list is the tallest thing on screen (the
        // reason this became a route on a phone at all). Dialog host: the DialogContent caps the height.
        layout === 'page' && 'sm:min-h-[calc(100svh-13rem)]',
        layout === 'dialog' && 'min-h-0 flex-1',
      )}
    >
      {/* The page needs this line (its breadcrumb says only "Thêm mục"); the dialog does not — its
          header already names the group and the filter, and printing both read as a stutter. */}
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
        <Card className={cn('gap-3', layout === 'dialog' && 'min-h-0 flex-1 overflow-hidden')}>
          {/* One row, same as every list toolbar in the app. */}
          <CardContent className="flex flex-row items-center gap-2 sm:gap-3">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                {filtered.map((i) => (
                  <li key={i.itemId}>
                    {/* The whole row is the label, so the tap target is the row and not the 16px box. */}
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

          {/* Action row INSIDE the card, like every other form in the app (2026-08-05 — it used to be a
              blurred bar bleeding to the page edges, which was the one action row here that did not look
              like the app's). The list above it is the part that scrolls, so this row stays visible
              without needing `position: sticky` — which a Card's `overflow-hidden` would break anyway. */}
          <CardContent className="flex items-center gap-2">
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

/** `/groups/<id>/add` — the ROUTE host (the phone path; desktop opens the dialog host instead). */
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
