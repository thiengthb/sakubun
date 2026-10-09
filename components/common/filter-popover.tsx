'use client';

import { type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BottomSheet, SHEET_CONTROL_CLASS } from '@/components/common/bottom-sheet';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/core/utils';

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

export interface FilterOption {
  value: string;
  label: string;
}

export function SelectFilterRow({
  label,
  value,
  onValueChange,
  options,
  className,
}: {
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly FilterOption[];
  className?: string;
}) {
  return (
    <FilterRow label={label} className={className}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterRow>
  );
}

export interface FilterChip {
  key: string;
  /** What is being filtered — "Cấp JLPT". */
  label: string;
  /** What it is filtered to — "N3". */
  value: string;
  onClear: () => void;
}

/**
 * One chip for a select-style filter, or null when it sits at its off value. Written as a helper so
 * a screen with nine filters lists them once — as data — instead of nine copies of the same
 * "is it on? then look up its label" branch.
 */
export function chipFor(
  key: string,
  label: string,
  value: string,
  options: readonly FilterOption[],
  onClear: () => void,
  off = 'all',
): FilterChip | null {
  if (value === off) return null;
  return { key, label, value: options.find((o) => o.value === value)?.label ?? value, onClear };
}

// The popover answers "what CAN I filter by"; it cannot answer "what AM I filtering by" once it
// closes. Without this strip a narrowed list looks like a short list, and the only way to find out
// why is to reopen the popover and read every select. Each chip clears just itself.
export function FilterChips({
  chips,
  onReset,
  className,
}: {
  chips: readonly FilterChip[];
  onReset?: () => void;
  className?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClear}
          aria-label={`Bỏ lọc ${chip.label}: ${chip.value}`}
          className="group/chip inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pr-1 pl-2.5 text-xs transition-colors hover:border-foreground/30 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* min-w-0: flex items default to min-width:auto, so without it `truncate` never fires
              and a long value widens the pill instead of ellipsing. */}
          <span className="min-w-0 truncate text-muted-foreground">{chip.label}</span>
          <span className="min-w-0 truncate font-medium">{chip.value}</span>
          <span
            aria-hidden
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover/chip:bg-background group-hover/chip:text-foreground"
          >
            <X className="size-3" />
          </span>
        </button>
      ))}
      {chips.length > 1 && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="ml-0.5 rounded-sm px-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Xóa tất cả
        </button>
      )}
    </div>
  );
}

function ResetLink({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      Đặt lại
    </button>
  );
}

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
  const isMobile = useIsMobile();

  const trigger = (
    <ExpandingIconButton
      icon={SlidersHorizontal}
      label={activeCount > 0 ? `Bộ lọc (${activeCount} đang bật)` : 'Bộ lọc'}
      badge={
        activeCount > 0 ? (
          <Badge
            className="h-4 min-w-4 justify-center px-1 text-xs tabular-nums max-md:hidden"
            variant="secondary"
          >
            {activeCount}
          </Badge>
        ) : null
      }
    />
  );

  return (
    <>
      {/* No "Xóa lọc" button here any more: FilterChips renders "Xóa tất cả" next to the chips it
          clears, which is where you are already looking once a filter is on. */}
      <div className="relative shrink-0">
        {isMobile ? (
          <BottomSheet
            trigger={trigger}
            title="Bộ lọc"
            description={
              activeCount > 0
                ? `Đang lọc theo ${activeCount} điều kiện.`
                : 'Chọn điều kiện để thu hẹp danh sách.'
            }
            headerAction={activeCount > 0 && onReset ? <ResetLink onReset={onReset} /> : undefined}
            closeLabel="Xem kết quả"
            className={SHEET_CONTROL_CLASS}
          >
            <div className="space-y-4">{children}</div>
          </BottomSheet>
        ) : (
          <Popover>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align={align} className="max-h-[70vh] w-80 gap-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Bộ lọc</span>
                {activeCount > 0 && onReset && <ResetLink onReset={onReset} />}
              </div>
              <div className="grid grid-cols-2 gap-3">{children}</div>
            </PopoverContent>
          </Popover>
        )}

        {activeCount > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-xs leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-background md:hidden"
          >
            {activeCount}
          </span>
        )}
      </div>
    </>
  );
}
