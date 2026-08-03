'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface TabSelectItem {
  value: string;
  label: string;
}

/**
 * The app's tab switcher: a `TabsList` from `md` up, a `Select` below it. Drop-in replacement for a
 * hand-written `<TabsList>` inside a `<Tabs>` — it must still sit inside that provider, because the
 * desktop half is the real Radix tab list.
 *
 * Why a select on small screens. A tab bar spends horizontal space proportional to the NUMBER of tabs,
 * on the axis that has none: /settings has six, which at 360px either scrolled sideways (so the tab you
 * want is off-screen and there is no cue that it exists) or wrapped onto two rows above every page.
 * A select spends space proportional to the LONGEST LABEL instead — constant in the number of options —
 * and it names the current one, which is the thing a tab bar communicates by position and a wrapped
 * tab bar communicates badly.
 *
 * Both halves are driven by the SAME `value` / `onValueChange`, so the active tab survives a resize and
 * there is one source of truth. The select is rendered in addition to (not instead of) the list, with
 * each hidden at the other's breakpoint — cheaper than measuring the viewport in JS, and it means no
 * layout flash on first paint.
 */
export function TabSelect({
  items,
  value,
  onValueChange,
  /** Accessible name for the mobile select (the tab bar gets its name from the tabs themselves). */
  label = 'Chọn mục',
}: {
  items: readonly TabSelectItem[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
}) {
  return (
    <>
      <Select value={value} onValueChange={onValueChange}>
        {/* h-8 matches the toolbar buttons + search box; w-auto so it hugs the longest label rather
            than stretching across the row. */}
        <SelectTrigger size="sm" className="h-8 w-auto md:hidden" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TabsList className="max-md:hidden">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </>
  );
}
