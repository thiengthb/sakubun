'use client';

import { ActiveTabSelect } from '@/components/shared/active-tab-select';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface TabSelectItem {
  value: string;
  label: string;
}

export function TabSelect({
  items,
  value,
  onValueChange,
  label = 'Chọn mục',
}: {
  items: readonly TabSelectItem[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
}) {
  return (
    <>
      <ActiveTabSelect
        items={items}
        value={value}
        onValueChange={onValueChange}
        label={label}
        className="md:hidden"
      />

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
