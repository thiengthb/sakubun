'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ResourceAddForm, type ResourceKind } from '@/components/features/resources/resource-add-form';

const LABEL: Record<ResourceKind, string> = {
  grammar: 'Thêm ngữ pháp',
  vocab: 'Thêm từ vựng',
};

export function ResourceAddButton({ kind }: { kind: ResourceKind }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ExpandingIconButton
        asChild
        icon={Plus}
        label={LABEL[kind]}
        variant="default"
        className="md:hidden"
      >
        <Link href={`/resources/new?kind=${kind}`} />
      </ExpandingIconButton>

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
