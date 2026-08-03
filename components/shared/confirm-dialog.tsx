'use client';

import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * A destructive-confirm modal: title + description + (optional body) + a Cancel/Confirm footer whose
 * confirm button spins while `pending`. Extracted from the 3 hand-rolled confirm dialogs (bulk-delete,
 * admin ban, account revoke-token) that repeated the same Dialog/Header/Footer scaffold. The TRIGGER and
 * open state stay with the caller — each drives `open` differently (a boolean, or a selected-target
 * memo) — so this component owns only the modal body + the two buttons. Form fields inside the confirm
 * (e.g. a ban reason) go in `children`, rendered between the description and the footer.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  children,
  cancelLabel = 'Huỷ',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  children?: ReactNode;
  cancelLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
