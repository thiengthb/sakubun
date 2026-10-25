'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/core/utils';

// The magnifier sits in a small tile, quiet at rest and primary while you type. The tile lets
// clicks through, so pressing it focuses the field.
export function SearchInput({
  className,
  ...props
}: React.ComponentProps<typeof Input> & { className?: string }) {
  return (
    <div className={cn('group/search relative w-full sm:max-w-xs', className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm bg-muted text-muted-foreground transition-colors group-focus-within/search:bg-primary group-focus-within/search:text-primary-foreground md:size-5"
      >
        <Search className="size-4" />
      </span>
      <Input {...props} className="pl-10 md:pl-8" />
    </div>
  );
}
