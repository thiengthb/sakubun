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
  label?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          'h-8 w-auto min-w-0 gap-1 rounded-lg border-transparent bg-muted p-[3px] pr-1.5 hover:bg-muted dark:bg-muted dark:hover:bg-muted',
          className,
        )}
      >
        <span className="flex min-w-0 items-center rounded-md bg-primary px-2.5 py-0.5 text-sm font-medium text-primary-foreground">
          <span className="max-w-[8.5rem] truncate">
            <SelectValue>{items.find((i) => i.value === value)?.label}</SelectValue>
          </span>
        </span>
      </SelectTrigger>
      <SelectContent align="start" position="popper" sideOffset={6}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
