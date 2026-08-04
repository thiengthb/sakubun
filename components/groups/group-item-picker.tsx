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
export function GroupItemPicker({
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
  const router = useRouter();
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
      if (toastResult(r, (d) => `Đã thêm ${d.added} mục`)) {
        router.push(`/groups/${group.id}`);
        router.refresh();
      }
    });
  };

  return (
    <PageShell section="groups" action="addItems" width="narrow">
      <p className="text-muted-foreground">
        Thêm vào <span className="font-medium text-foreground">{group.name}</span>. Chỉ hiện{' '}
        {mixed ? 'ngữ pháp và từ vựng' : GROUP_KIND_LABELS[group.kind].toLowerCase()} chưa thuộc nhóm.
      </p>

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
            <Button variant="outline" onClick={() => router.back()}>
              Quay lại nhóm
            </Button>
          }
        />
      ) : (
        <>
          {/* One row, same as every list toolbar in the app. */}
          <div className="flex flex-row items-center gap-2 sm:gap-3">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo mẫu, cách đọc hoặc nghĩa…"
              className="min-w-0 flex-1 sm:max-w-xs"
            />
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {filtered.length}/{addable.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={SearchX} title="Không khớp từ khoá." className="py-12" />
          ) : (
            <Card>
              <CardContent className="px-0">
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
              </CardContent>
            </Card>
          )}

          {/* Sticky action bar: on a phone the list is longer than the viewport, and an action row that
              scrolls away means scrolling back to the top to commit a choice made at the bottom.
              `-mx-4 px-4` lets the blurred bar bleed to the page edges while the buttons stay aligned. */}
          <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <span className="text-sm text-muted-foreground tabular-nums">Đã chọn {sel.size}</span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => router.back()} disabled={isPending}>
                Huỷ
              </Button>
              <Button onClick={submit} disabled={isPending || sel.size === 0}>
                <Plus className="size-4" aria-hidden />
                Thêm {sel.size > 0 ? sel.size : ''} mục
              </Button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
