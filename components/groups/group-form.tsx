'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { toastResult } from '@/lib/action-toast';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/shared/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GROUP_KIND_LABELS } from '@/components/groups/group-kind-badge';
import { createGroupAction, updateGroupAction } from '@/app/actions';
import { GROUP_KINDS, type GroupKind } from '@/lib/group-kinds';
import type { GroupSummary } from '@/lib/groups';

export function GroupForm({
  group,
  onDone,
  onCancel,
}: {
  group?: GroupSummary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!group;
  const [name, setName] = useState(group?.name ?? '');
  const [kind, setKind] = useState<GroupKind>(group?.kind ?? 'mixed');
  const [note, setNote] = useState(group?.note ?? '');
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!name.trim()) {
      toast.error('Tên nhóm không được trống');
      return;
    }
    startTransition(async () => {
      const r = editing
        ? await updateGroupAction(group.id, { name: name.trim(), kind, note: note.trim() || null })
        : await createGroupAction({ name: name.trim(), kind, note: note.trim() || undefined });
      if (toastResult(r, editing ? 'Đã lưu' : 'Đã tạo nhóm')) onDone();
    });
  };

  return (
    <div className="space-y-6">
      <Field label="Tên nhóm">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: N4 – Thể て"
        />
      </Field>

      <Field
        label="Loại"
        info="Loại quyết định mục nào được thêm: Từ vựng chỉ nhận từ, Ngữ pháp chỉ nhận mẫu, Hỗn hợp nhận cả hai."
      >
        <div className="grid grid-cols-3 gap-2">
          {GROUP_KINDS.map((k) => (
            <Button
              key={k}
              type="button"
              variant={kind === k ? 'default' : 'outline'}
              onClick={() => setKind(k)}
              className="w-full"
            >
              {GROUP_KIND_LABELS[k]}
            </Button>
          ))}
        </div>
      </Field>

      <Field label="Ghi chú (tuỳ chọn)">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Chủ đề / vì sao các mục này thuộc cùng nhóm"
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Huỷ
        </Button>
        <Button onClick={submit} disabled={isPending}>
          {editing ? 'Lưu' : 'Tạo nhóm'}
        </Button>
      </div>
    </div>
  );
}
