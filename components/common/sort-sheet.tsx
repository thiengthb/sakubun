'use client';

import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BottomSheet, ResetButton, SHEET_CONTROL_CLASS } from '@/components/common/bottom-sheet';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { cn } from '@/lib/core/utils';

export interface SortOption {
  id: string;
  label: string;
}

const NONE = '__none__';

export function SortSheet({
  options,
  columnId,
  desc,
  onChange,
}: {
  options: SortOption[];
  columnId: string | null;
  desc: boolean;
  onChange: (next: { id: string; desc: boolean } | null) => void;
}) {
  const active = columnId !== null;
  const current = options.find((o) => o.id === columnId);
  const label = active ? `Sắp xếp: ${current?.label ?? ''}` : 'Sắp xếp';

  return (
    <div className="relative shrink-0 lg:hidden">
      <BottomSheet
        icon={ArrowUpDown}
        trigger={<ExpandingIconButton icon={ArrowUpDown} label="Sắp xếp" aria-label={label} />}
        title="Sắp xếp"
        description={
          active
            ? `Đang xếp theo ${current?.label ?? ''}, ${desc ? 'giảm dần' : 'tăng dần'}.`
            : 'Chọn trường để xếp lại danh sách.'
        }
        headerAction={active ? <ResetButton onReset={() => onChange(null)} /> : undefined}
        closeLabel="Xem kết quả"
        className={SHEET_CONTROL_CLASS}
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Xếp theo</Label>
          <Select
            value={columnId ?? NONE}
            onValueChange={(v) => onChange(v === NONE ? null : { id: v, desc })}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={NONE}>Thứ tự mặc định</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Chiều</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: false, label: 'Tăng dần', icon: ArrowUpNarrowWide },
                { value: true, label: 'Giảm dần', icon: ArrowDownWideNarrow },
              ] as const
            ).map((d) => (
              <Button
                key={d.label}
                type="button"
                size="lg"
                variant={active && desc === d.value ? 'secondary' : 'outline'}
                disabled={!active}
                aria-pressed={active && desc === d.value}
                className={cn('w-full', active && desc === d.value && 'border-primary/40')}
                onClick={() => columnId && onChange({ id: columnId, desc: d.value })}
              >
                <d.icon className="size-4" aria-hidden />
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      </BottomSheet>

      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-1 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-background"
        />
      )}
    </div>
  );
}
