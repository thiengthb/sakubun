'use client';

import { type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BottomSheet, SHEET_CONTROL_CLASS } from '@/components/shared/bottom-sheet';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
      {activeCount > 0 && onReset && (
        <Button variant="ghost" onClick={onReset} className="max-md:hidden">
          <X className="size-4" aria-hidden />
          Xóa lọc
        </Button>
      )}
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
