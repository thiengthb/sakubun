'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useServerAction } from '@/components/common/use-server-action';
import { Button } from '@/components/ui/button';
import { Field, FormActions } from '@/components/common/field';
import { ITEM_LIMITS, itemTextError, type LimitedField } from '@/lib/library/item-limits';
import { textLength } from '@/lib/library/group-limits';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { EditableItem } from '@/components/features/resources/row-actions';
import { updateItemAction } from '@/app/actions';
import { JLPT_LEVELS } from '@/lib/settings/schema';

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
  const [expression, setExpression] = useState(item.expression);
  const [reading, setReading] = useState(item.reading ?? '');
  const [meaningVi, setMeaningVi] = useState(item.meaningVi);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [level, setLevel] = useState(item.level ?? 'N5');
  const { run, isPending } = useServerAction(updateItemAction, {
    success: 'Đã lưu',
    onSuccess:
      onDone ??
      (() => {
        router.push(backHref);
        router.refresh();
      }),
  });

  const notesLabel = kind === 'grammar' ? 'Cấu trúc / ghi chú' : 'Ví dụ';
  const exprLabel = kind === 'grammar' ? 'Mẫu ngữ pháp' : 'Từ';

  // Too long shows at once, while typing; empty only once the form is sent. An old item longer
  // than a limit keeps its value: only a changed value is checked, as the server does.
  const [sent, setSent] = useState(false);
  const tooLong = (field: LimitedField, value: string, was: string | null | undefined) =>
    value.trim() === (was ?? '').trim() ? null : itemTextError(field, value);
  const errors = {
    expression:
      tooLong('expression', expression, item.expression) ??
      (sent && !expression.trim() ? `Cần nhập ${exprLabel.toLowerCase()}` : null),
    reading: tooLong('reading', reading, item.reading),
    meaningVi:
      tooLong('meaningVi', meaningVi, item.meaningVi) ??
      (sent && !meaningVi.trim() ? 'Cần nhập nghĩa' : null),
  };

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSent(true);
    const bad =
      !expression.trim() || errors.expression
        ? '#edit-expression'
        : errors.reading
          ? '#edit-reading'
          : !meaningVi.trim() || errors.meaningVi
            ? '#edit-meaning'
            : null;
    if (bad) {
      e.currentTarget.querySelector<HTMLElement>(bad)?.focus();
      return;
    }
    run(item.itemId, {
      expression: expression.trim(),
      reading: reading.trim() || null,
      meaningVi: meaningVi.trim(),
      notes: notes.trim() || null,
      ...(kind === 'grammar' ? { level } : {}),
    });
  };

  return (
    <form onSubmit={save} noValidate className="@container space-y-6">
      <Field
        label={exprLabel}
        required
        error={errors.expression}
        count={{ value: textLength(expression.trim()), max: ITEM_LIMITS.expression }}
        info={
          kind === 'grammar'
            ? 'Mẫu ngữ pháp (tiếng Nhật). Sửa nội dung KHÔNG ảnh hưởng lịch ôn (FSRS).'
            : 'Từ (tiếng Nhật). Sửa nội dung KHÔNG ảnh hưởng lịch ôn (FSRS).'
        }
      >
        <Input
          id="edit-expression"
          lang="ja"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 @2xl:grid-cols-2">
        <Field
          label="Cách đọc"
          error={errors.reading}
          count={{ value: textLength(reading.trim()), max: ITEM_LIMITS.reading }}
        >
          <Input
            id="edit-reading"
            lang="ja"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            placeholder="kana"
          />
        </Field>
        {kind === 'grammar' && (
          <Field label="Cấp JLPT">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {JLPT_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <Field
        label="Nghĩa (tiếng Việt)"
        required
        error={errors.meaningVi}
        count={{ value: textLength(meaningVi.trim()), max: ITEM_LIMITS.meaningVi }}
      >
        <Input id="edit-meaning" value={meaningVi} onChange={(e) => setMeaningVi(e.target.value)} />
      </Field>

      <Field
        label={notesLabel}
        info={
          kind === 'grammar' ? 'Cấu trúc / cách chia / ghi chú thêm.' : 'Câu ví dụ chứa từ này.'
        }
      >
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </Field>

      <FormActions>
        {onDone ? (
          <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
            Hủy
          </Button>
        ) : (
          <Button variant="outline" asChild disabled={isPending}>
            <Link href={backHref}>Hủy</Link>
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          Lưu
        </Button>
      </FormActions>
    </form>
  );
}
