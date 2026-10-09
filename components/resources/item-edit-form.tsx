'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useServerAction } from '@/components/shared/use-server-action';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/shared/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { EditableItem } from '@/components/resources/row-actions';
import { updateItemAction } from '@/app/actions';
import { JLPT_LEVELS } from '@/lib/settings-schema';

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

  const save = () => {
    if (!expression.trim() || !meaningVi.trim()) {
      toast.error('Từ / mẫu và nghĩa không được trống');
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
    <div className="space-y-6">
      <Field
        label={exprLabel}
        info={
          kind === 'grammar'
            ? 'Mẫu ngữ pháp (tiếng Nhật). Sửa nội dung KHÔNG ảnh hưởng lịch ôn (FSRS).'
            : 'Từ (tiếng Nhật). Sửa nội dung KHÔNG ảnh hưởng lịch ôn (FSRS).'
        }
      >
        <Input lang="ja" value={expression} onChange={(e) => setExpression(e.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cách đọc">
          <Input
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

      <Field label="Nghĩa (tiếng Việt)">
        <Input value={meaningVi} onChange={(e) => setMeaningVi(e.target.value)} />
      </Field>

      <Field
        label={notesLabel}
        info={
          kind === 'grammar' ? 'Cấu trúc / cách chia / ghi chú thêm.' : 'Câu ví dụ chứa từ này.'
        }
      >
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onDone ? (
          <Button variant="outline" onClick={onDone} disabled={isPending}>
            Hủy
          </Button>
        ) : (
          <Button variant="outline" asChild disabled={isPending}>
            <Link href={backHref}>Hủy</Link>
          </Button>
        )}
        <Button onClick={save} disabled={isPending}>
          Lưu
        </Button>
      </div>
    </div>
  );
}
