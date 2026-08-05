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
import { BottomSheet, SHEET_CONTROL_CLASS } from '@/components/shared/bottom-sheet';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { cn } from '@/lib/utils';

/** One thing the list can be ordered by. `id` is the table column id; `label` is what the user reads. */
export interface SortOption {
  id: string;
  label: string;
}

/** Sentinel for "no sort" — Radix Select cannot hold an empty string as a value. */
const NONE = '__none__';

/**
 * "Sắp xếp" for the phone — the sort control that a desktop gets from its column headers.
 *
 * WHY IT EXISTS (2026-08-05, user report): sorting a `DataTable` means clicking the header of the column
 * you want ordered. Below `md` there ARE no headers — the table is replaced by a stacked card list
 * (`DataTable`'s `renderCard`), which is the right shape for a 390px screen but takes every sort with it.
 * The result was a phone that could search and filter a list of hundreds but only ever see it in one
 * fixed order, with no way to ask for "đến hạn sớm nhất" or "mới thêm".
 *
 * It writes the SAME `sorting` state the headers write, so a sort chosen on a phone is the sort the
 * desktop shows (and it rides along in the URL / sessionStorage like the rest of the view). One
 * difference by design: this is SINGLE-column. Multi-column sort on a desktop is shift-click, a gesture
 * that does not exist on touch, and stacking sort keys is not a thing anyone does on a phone list.
 *
 * Shape: a select for the FIELD (mirroring "Sắp xếp" in the groups filter, the app's existing sort
 * control) plus two buttons for the DIRECTION — direction is a binary choice, so it is worth the extra
 * row rather than doubling the select's options into "A → Z / Z → A" for every field.
 */
export function SortSheet({
  options,
  columnId,
  desc,
  onChange,
}: {
  options: SortOption[];
  /** Currently sorted column id, or null when the list is in its natural order. */
  columnId: string | null;
  desc: boolean;
  /** `null` clears the sort. */
  onChange: (next: { id: string; desc: boolean } | null) => void;
}) {
  const active = columnId !== null;
  const current = options.find((o) => o.id === columnId);
  const label = active ? `Sắp xếp: ${current?.label ?? ''}` : 'Sắp xếp';

  return (
    // Same relative wrapper + corner dot as the filter trigger (see FilterPopover): "this list is not in
    // its default order" has to be visible without opening the sheet, and the two toolbar controls must
    // signal their active state the same way.
    <div className="relative shrink-0 md:hidden">
      <BottomSheet
        trigger={<ExpandingIconButton icon={ArrowUpDown} label={label} />}
        title="Sắp xếp"
        description={
          active
            ? `Đang xếp theo ${current?.label ?? ''}, ${desc ? 'giảm dần' : 'tăng dần'}.`
            : 'Chọn trường để xếp lại danh sách.'
        }
        headerAction={
          active ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Đặt lại
            </button>
          ) : undefined
        }
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
          {/* Disabled while there is no field: a direction with nothing to order is a control that does
              nothing when tapped, which is worse than one that says it is unavailable. */}
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
