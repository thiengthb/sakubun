'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ResourceAddForm, type ResourceKind } from '@/components/resources/resource-add-form';

const LABEL: Record<ResourceKind, string> = {
  grammar: 'Thêm ngữ pháp',
  vocab: 'Thêm từ vựng',
};

/**
 * The toolbar button that opens the add form — MODAL on a wide screen, ROUTE on a narrow one
 * (user ask 2026-08-04).
 *
 * Why both, and why the split is by breakpoint rather than a preference: a dialog keeps the list you
 * were working in visible behind it and gets you back in one Esc, which is the right shape on a desktop
 * where there is room for both. On a phone there is no "behind" — the dialog covers the whole screen
 * anyway, and then it is a scrolling box inside a scrolling page whose own header eats the top of a
 * 640px viewport while the keyboard covers the bottom (see ResourceAddForm). There the route wins: real
 * back button, real URL, and the work survives an accidental navigation.
 *
 * Implemented as two triggers hidden at each other's breakpoint (`md:hidden` / `max-md:hidden`) instead
 * of measuring the viewport in JS — cheaper, and no flash of the wrong control on first paint (same
 * technique as TabSelect). `/resources/new` stays a real, linkable page either way.
 */
export function ResourceAddButton({ kind }: { kind: ResourceKind }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Phone: navigate. */}
      <ExpandingIconButton
        asChild
        icon={Plus}
        label={LABEL[kind]}
        variant="default"
        className="md:hidden"
      >
        <Link href={`/resources/new?kind=${kind}`} />
      </ExpandingIconButton>

      {/* Desktop: modal over the list. */}
      <ExpandingIconButton
        icon={Plus}
        label={LABEL[kind]}
        variant="default"
        className="max-md:hidden"
        onClick={() => setOpen(true)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{LABEL[kind]}</DialogTitle>
            <DialogDescription>
              Nhập từng mục, dán nhiều dòng, hoặc tải file Excel.
            </DialogDescription>
          </DialogHeader>
          <ResourceAddForm
            kind={kind}
            // In the dialog the form must NOT navigate to /resources (it is already there) — close and
            // refresh so the new rows appear in the list behind.
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
