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

/**
 * Create/edit form for a study group, shared by the two ROUTES that host it (`/groups/new` and
 * `/groups/<id>/edit` — both were dialogs until 2026-08-05). Kind is a segmented control — it drives
 * which items may join (see the kind-guard in lib/groups.ts). Narrowing kind does NOT evict existing
 * members; it only gates future adds (the operator-approved behavior, plan 2026-07-21).
 */
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

      {/* Plain action row, not a DialogFooter (2026-08-05): both hosts are now ROUTES
          (/groups/new · /groups/<id>/edit), so there is no Dialog context for DialogClose to close, and
          "Huỷ" means "go back" — the host decides where back is. Same row shape as the resource add/edit
          forms: `flex-col-reverse` below sm so the primary action is the one under the thumb. */}
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
