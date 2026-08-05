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
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { GroupForm } from '@/components/groups/group-form';
import { GroupItemPickerBody } from '@/components/groups/group-item-picker';
import type { GroupDetail, GroupMemberItem, GroupSummary } from '@/lib/groups';

/**
 * The three group actions — create · edit · add items — each as MODAL from `md` up and as a ROUTE below
 * it (user ask 2026-08-05, matching what `ResourceAddButton` already does for grammar/vocab).
 *
 * Why the split is by breakpoint and not a preference: a dialog keeps the list you were working in
 * visible behind it and closes with one Esc, which is the right shape on a desktop that has room for
 * both. On a phone there is no "behind" — the dialog covers the screen anyway, and then it is a
 * scrolling box inside a scrolling page whose header eats the top of the viewport while the keyboard
 * eats the bottom. There the route wins: a real back button, a real URL, and work that survives a
 * mistap.
 *
 * Implemented as two triggers hidden at each other's breakpoint (`md:hidden` / `max-md:hidden`) rather
 * than measuring the viewport in JS — cheaper, and no flash of the wrong control on first paint (the
 * same technique as `TabSelect`). The routes stay real, linkable pages either way.
 *
 * Both hosts render the SAME body component (`GroupForm`, `GroupItemPickerBody`), so the validation, the
 * kind guard and the submit path cannot drift between the phone and the desktop.
 */

/** Refresh the server components after a write, so the new/edited group shows without a reload. */
function useAfterWrite(onClose: () => void) {
  const router = useRouter();
  return () => {
    onClose();
    router.refresh();
  };
}

/** "Tạo nhóm" — toolbar (icon that expands on hover) or the empty-state button. */
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

/** "Sửa nhóm" — a ghost icon button on a group card, or a toolbar action on the group's own page. */
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

/** "Thêm mục" — the kind-guarded item picker. Disabled (no navigation, no dialog) when nothing can join. */
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

  // Nothing left to add: one inert control at both breakpoints. A disabled <a> is not a thing, so the
  // mobile path becomes a real disabled button rather than a link that goes to an empty picker.
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
        {/* flex-col + a capped height: the picker body takes `layout="dialog"`, whose list is the part
            that scrolls, so the header and the action row stay put. */}
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
