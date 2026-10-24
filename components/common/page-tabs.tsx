'use client';

import type { LucideIcon } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/core/utils';

export interface PageTabItem {
  value: string;
  label: string;
  /** Shown from 768px up; phones keep the bare word. */
  icon?: LucideIcon;
}

// The template pages' tabs (docs/ui-standard.md › Đầu trang): underlined, on PageShell's `tabs`
// row, whose bottom border the active line sits on. Must render inside a <Tabs>.
export function PageTabs({
  items,
  label = 'Chọn mục',
  className,
}: {
  items: readonly PageTabItem[];
  label?: string;
  className?: string;
}) {
  return (
    <TabsList variant="line" aria-label={label} className={cn('gap-4 p-0', className)}>
      {items.map((item) => (
        <TabsTrigger
          key={item.value}
          value={item.value}
          className="flex-none px-0 data-active:text-foreground group-data-horizontal/tabs:after:-bottom-px dark:data-active:text-foreground"
        >
          {item.icon && <item.icon className="size-4 max-md:hidden" aria-hidden />}
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
