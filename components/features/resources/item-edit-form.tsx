'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useServerAction } from '@/components/common/use-server-action';
import { Button } from '@/components/ui/button';
import { FormActions, SubmitButton } from '@/components/common/field';
import type { EditableItem } from '@/components/features/resources/row-actions';
import {
  ItemFields,
  useItemDraft,
  type ItemDraft,
} from '@/components/features/resources/item-fields';
import { updateItemAction } from '@/app/actions';

export function ItemEditForm({
  item,
  kind,
  onDone,
}: {
  item: EditableItem;
  kind: 'grammar' | 'vocab';
  onDone?: () => void;
}) {
  const router = useRouter();
  const backHref = `/resources/${item.itemId}`;
  const original: ItemDraft = {
    expression: item.expression,
    reading: item.reading ?? '',
    meaningVi: item.meaningVi,
    level: item.level ?? '',
    notes: item.notes ?? '',
  };
  const { draft, set, errors, ready } = useItemDraft(original);
  const { run, isPending } = useServerAction(updateItemAction, {
    success: 'Đã lưu',
    onSuccess:
      onDone ??
      (() => {
        router.push(backHref);
        router.refresh();
      }),
  });

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready) return;
    run(item.itemId, {
      expression: draft.expression.trim(),
      reading: draft.reading.trim() || null,
      meaningVi: draft.meaningVi.trim(),
      notes: draft.notes.trim() || null,
      ...(draft.level ? { level: draft.level } : {}),
    });
  };

  return (
    <form onSubmit={save} noValidate className="@container space-y-4">
      <ItemFields kind={kind} draft={draft} set={set} errors={errors} idPrefix="edit" />
      <FormActions>
        {onDone ? (
          <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
            Huỷ
          </Button>
        ) : (
          <Button variant="outline" asChild disabled={isPending}>
            <Link href={backHref}>Huỷ</Link>
          </Button>
        )}
        <SubmitButton ready={ready} pending={isPending}>
          {isPending ? 'Đang lưu…' : 'Lưu'}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
