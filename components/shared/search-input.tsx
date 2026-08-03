'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * The ONE search box — every search in the app uses this (tables, groups, library, history, pickers) so
 * width + height + the magnifier affordance are identical everywhere and change in one place. Default
 * size is `w-full sm:max-w-xs` (full on mobile, capped on desktop); the inner input is the standard
 * `h-8`. `className` styles the WRAPPER — pass a width only to override the default (e.g. `sm:max-w-none`
 * to fill a dialog). The icon is decorative (pointer-events-none) and the input keeps left padding for it.
 */
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
