'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface ActiveTabSelectItem {
  value: string;
  label: string;
}

/**
 * A Select dressed as a one-item TAB BAR — the compact form of the app's tab switcher.
 *
 * Three layers, outside in, which is what makes it read as "a tab you can change" rather than as a
 * generic dropdown:
 *   1. the TRACK — `bg-muted`, rounded, 3px of padding: the same rail a `TabsList` draws
 *   2. the ACTIVE PILL — `bg-primary` + `text-primary-foreground`, exactly the treatment `TabsTrigger`
 *      gives `data-active`, so the current section looks selected in the same visual language
 *   3. the CHEVRON, sharing the track with the pill: the affordance that says the other tabs are one
 *      tap away and are listed below
 *
 * It is built on Select (not on Tabs) on purpose: below `md` a real tab bar costs width proportional to
 * the NUMBER of tabs on the axis that has none, while this costs the width of the ACTIVE LABEL and is
 * constant in the number of options. See `TabSelect`, which pairs this with a real `TabsList` above `md`.
 *
 * Standalone — it does NOT need a `<Tabs>` provider, so it also works as a plain section switcher.
 */
export function ActiveTabSelect({
  items,
  value,
  onValueChange,
  label = 'Chọn mục',
  className,
}: {
  items: readonly ActiveTabSelectItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name — the trigger shows only the current label, so it needs one. */
  label?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        // h-8 matches the toolbar buttons + search box; w-auto so the track hugs the active label
        // instead of stretching across the row. border-transparent overrides the field border the
        // base trigger carries — a tab rail has no outline.
        className={cn(
          'h-8 w-auto min-w-0 gap-1 rounded-lg border-transparent bg-muted p-[3px] pr-1.5 hover:bg-muted dark:bg-muted dark:hover:bg-muted',
          className,
        )}
      >
        {/* The pill is capped and truncates. It shares the header row with the breadcrumb, and a long
            tab name ("Dán danh sách") pushed the whole control onto a second line at 360px — which is
            the one thing this control exists to avoid. Capped, it costs a known width whatever the tab
            is called, and the full names are one tap away in the list below. */}
        <span className="flex min-w-0 items-center rounded-md bg-primary px-2.5 py-0.5 text-sm font-medium text-primary-foreground">
          <span className="max-w-[8.5rem] truncate">
            <SelectValue />
          </span>
        </span>
      </SelectTrigger>
      {/* align="start" so the list opens under the pill's left edge — the pill is the anchor the eye
          is already on, and on a right-aligned header row a centred menu would drift off-screen. */}
      <SelectContent align="start">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
