'use client';

import { type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export function BottomSheet({
  trigger,
  title,
  description,
  headerAction,
  closeLabel = 'Xong',
  children,
  className,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  headerAction?: ReactNode;
  closeLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'max-h-[85dvh] gap-0 rounded-t-2xl',
          className,
        )}
      >
        <div className="flex shrink-0 justify-center pt-2 pb-1">
          <span aria-hidden className="h-1 w-10 rounded-full bg-border" />
        </div>

        <SheetHeader className="shrink-0 gap-1 px-4 pt-1 pb-3">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-sm">{title}</SheetTitle>
            {headerAction}
          </div>
          <SheetDescription className="text-xs">{description}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2">{children}</div>

        <SheetFooter className="shrink-0 border-t border-border/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <SheetClose asChild>
            <Button size="lg" className="w-full">
              {closeLabel}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export const SHEET_CONTROL_CLASS =
  '[&_[data-slot=select-trigger]]:h-10! [&_[data-slot=select-trigger]]:rounded-lg!';
