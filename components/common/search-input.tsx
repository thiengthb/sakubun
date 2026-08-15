'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/core/utils';

export function SearchInput({
  className,
  ...props
}: React.ComponentProps<typeof Input> & { className?: string }) {
  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input {...props} className="pl-8" />
    </div>
  );
}
