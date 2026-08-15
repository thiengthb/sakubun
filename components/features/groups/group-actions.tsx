'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { GroupForm } from '@/components/features/groups/group-form';
import { GroupItemPickerBody } from '@/components/features/groups/group-item-picker';
import type { GroupDetail, GroupMemberItem, GroupSummary } from '@/lib/library/groups';

function useAfterWrite(onClose: () => void) {
  const router = useRouter();
  return () => {
    onClose();
    router.refresh();
  };
}

export function GroupCreateAction({ variant = 'toolbar' }: { variant?: 'toolbar' | 'empty' }) {
  const [open, setOpen] = useState(false);
  const done = useAfterWrite(() => setOpen(false));

  const mobileTrigger =
    variant === 'toolbar' ? (
      <ExpandingIconButton
        asChild
        icon={Plus}
        label="Tạo nhóm"
        variant="default"
        className="md:hidden"
      >
        <Link href="/groups/new" />
      </ExpandingIconButton>
    ) : (
      <Button asChild className="md:hidden">
        <Link href="/groups/new">
          <Plus className="size-4" aria-hidden />
          Tạo nhóm
        </Link>
      </Button>
    );

  return (
    <>
      {mobileTrigger}
      {variant === 'toolbar' ? (
        <ExpandingIconButton
          icon={Plus}
          label="Tạo nhóm"
          variant="default"
          className="max-md:hidden"
          onClick={() => setOpen(true)}
        />
      ) : (
        <Button className="max-md:hidden" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Tạo nhóm
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo nhóm mới</DialogTitle>
            <DialogDescription>
              Đặt tên và chọn loại. Loại quyết định mục nào được thêm.
            </DialogDescription>
          </DialogHeader>
          <GroupForm onDone={done} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GroupEditAction({
  group,
  variant = 'icon',
}: {
  group: GroupSummary;
  variant?: 'icon' | 'toolbar';
}) {
  const [open, setOpen] = useState(false);
  const done = useAfterWrite(() => setOpen(false));
  const href = `/groups/${group.id}/edit`;
  const label = `Sửa nhóm ${group.name}`;

  return (
    <>
      {variant === 'icon' ? (
        <>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8 md:hidden"
            aria-label={label}
          >
            <Link href={href}>
              <Pencil className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 max-md:hidden"
            aria-label={label}
            onClick={() => setOpen(true)}
          >
            <Pencil className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <ExpandingIconButton
            asChild
            icon={Pencil}
            label="Sửa"
            variant="outline"
            className="md:hidden"
          >
            <Link href={href} />
          </ExpandingIconButton>
          <ExpandingIconButton
            icon={Pencil}
            label="Sửa"
            variant="outline"
            className="max-md:hidden"
            onClick={() => setOpen(true)}
          />
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa nhóm</DialogTitle>
            <DialogDescription>
              Đổi tên, loại hoặc ghi chú. Thu hẹp loại KHÔNG gỡ mục đang có.
            </DialogDescription>
          </DialogHeader>
          <GroupForm group={group} onDone={done} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GroupAddItemsAction({
  group,
  addable,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
  variant = 'toolbar',
}: {
  group: GroupDetail;
  addable: GroupMemberItem[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
  variant?: 'toolbar' | 'empty';
}) {
  const [open, setOpen] = useState(false);
  const done = useAfterWrite(() => setOpen(false));
  const href = `/groups/${group.id}/add`;
  const empty = addable.length === 0;

  if (empty)
    return variant === 'toolbar' ? (
      <ExpandingIconButton icon={Plus} label="Thêm mục" variant="default" disabled />
    ) : (
      <Button disabled>
        <Plus className="size-4" aria-hidden />
        Thêm mục
      </Button>
    );

  return (
    <>
      {variant === 'toolbar' ? (
        <>
          <ExpandingIconButton
            asChild
            icon={Plus}
            label="Thêm mục"
            variant="default"
            className="md:hidden"
          >
            <Link href={href} />
          </ExpandingIconButton>
          <ExpandingIconButton
            icon={Plus}
            label="Thêm mục"
            variant="default"
            className="max-md:hidden"
            onClick={() => setOpen(true)}
          />
        </>
      ) : (
        <>
          <Button asChild className="md:hidden">
            <Link href={href}>
              <Plus className="size-4" aria-hidden />
              Thêm mục
            </Link>
          </Button>
          <Button className="max-md:hidden" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Thêm mục
          </Button>
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thêm mục vào “{group.name}”</DialogTitle>
            <DialogDescription>Chỉ hiện mục đúng loại và chưa thuộc nhóm.</DialogDescription>
          </DialogHeader>
          <GroupItemPickerBody
            group={group}
            addable={addable}
            voiceSpeaker={voiceSpeaker}
            speechRate={speechRate}
            showFurigana={showFurigana}
            layout="dialog"
            onDone={done}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
