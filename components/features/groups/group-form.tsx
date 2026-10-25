'use client';

import { useState, useTransition } from 'react';
import { toastResult } from '@/lib/core/action-toast';
import { Button } from '@/components/ui/button';
import { Field, FormActions } from '@/components/common/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import {
  GROUP_NAME_MAX,
  GROUP_NOTE_MAX,
  groupTextError,
  textLength,
} from '@/lib/library/group-limits';
import { createGroupAction, updateGroupAction } from '@/app/actions';
import { GROUP_KINDS, type GroupKind } from '@/lib/library/group-kinds';
import type { GroupSummary } from '@/lib/library/groups';

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

  const [sent, setSent] = useState(false);
  // Too long shows at once, while typing; empty only once the form is sent.
  const nameError =
    groupTextError('name', name) ?? (sent && !name.trim() ? 'Cần nhập tên nhóm' : null);
  const noteError = groupTextError('note', note);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSent(true);
    if (!name.trim() || nameError || noteError) {
      e.currentTarget
        .querySelector<HTMLElement>(nameError || !name.trim() ? '#group-name' : '#group-note')
        ?.focus();
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
    <form onSubmit={submit} noValidate className="space-y-6">
      <Field
        label="Tên nhóm"
        required
        error={nameError}
        count={{ value: textLength(name.trim()), max: GROUP_NAME_MAX }}
      >
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: N4 – Thể て"
        />
      </Field>

      <Field
        label="Loại"
        info={
          'Loại quyết định mục nào được thêm: Từ vựng chỉ nhận từ, Ngữ pháp chỉ nhận mẫu, Hỗn hợp nhận cả hai.' +
          (editing ? ' Thu hẹp loại không gỡ mục đang có, chỉ chặn mục mới không đúng loại.' : '')
        }
      >
        <ToggleGroup
          type="single"
          variant="choice"
          value={kind}
          onValueChange={(v) => v && setKind(v as GroupKind)}
          className="grid w-full grid-cols-3 gap-1.5"
        >
          {GROUP_KINDS.map((k) => (
            <ToggleGroupItem key={k} value={k}>
              {GROUP_KIND_LABELS[k]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field
        label="Ghi chú"
        error={noteError}
        count={{ value: textLength(note.trim()), max: GROUP_NOTE_MAX }}
      >
        <Textarea
          id="group-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Chủ đề / vì sao các mục này thuộc cùng nhóm"
        />
      </Field>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Huỷ
        </Button>
        <Button type="submit" disabled={isPending}>
          {editing ? 'Lưu' : 'Thêm nhóm'}
        </Button>
      </FormActions>
    </form>
  );
}
