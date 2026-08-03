'use client';

import { type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { cn } from '@/lib/utils';

/** A labelled control inside a filter popover (shared by /history + /resources tables). */
export function FilterRow({
  label,
  className,
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Shared "Bộ lọc" popover: an expanding filter-icon button (with an active-filter count badge) that
 * opens a 2-column grid of filter controls, plus a reset affordance. The caller owns the filter state
 * and renders `FilterRow`s as children. One pattern for every data view (history + resource tables).
 *
 * When any filter is active it also renders a standalone "Xóa lọc" ghost button to the LEFT of the
 * trigger (in addition to the in-popover "Đặt lại"), so every filtered surface gets the same clear
 * affordance the history view pioneered — callers just pass `onReset` and render inside a flex row.
 */
export function FilterPopover({
  activeCount,
  onReset,
  align = 'start',
  children,
}: {
  activeCount: number;
  onReset?: () => void;
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
}) {
  return (
    <>
      {activeCount > 0 && onReset && (
        // `default` size (h-8) so it lines up with the search box + the other toolbar buttons.
        <Button variant="ghost" onClick={onReset}>
          <X className="size-4" aria-hidden />
          Xóa lọc
        </Button>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <ExpandingIconButton
            icon={SlidersHorizontal}
            label="Bộ lọc"
            badge={
              activeCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 justify-center px-1 text-xs tabular-nums"
                >
                  {activeCount}
                </Badge>
              ) : null
            }
          />
        </PopoverTrigger>
        <PopoverContent align={align} className="max-h-[70vh] w-80 gap-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Bộ lọc</span>
            {activeCount > 0 && onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Đặt lại
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">{children}</div>
        </PopoverContent>
      </Popover>
    </>
  );
}
