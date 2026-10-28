'use client';

import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { isPlainIcon } from '@/lib/design/plain-icons';
import { cn } from '@/lib/core/utils';

// Laptop: the icon alone, opening to its word on hover, keyboard focus or while its menu is open.
const OPENS = cn(
  'max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out motion-reduce:transition-none',
  'group-hover/button:ml-1.5 group-hover/button:max-w-40 group-hover/button:opacity-100',
  'group-focus-visible/button:ml-1.5 group-focus-visible/button:max-w-40 group-focus-visible/button:opacity-100',
  'group-aria-[expanded=true]/button:ml-1.5 group-aria-[expanded=true]/button:max-w-40 group-aria-[expanded=true]/button:opacity-100',
);

/**
 * A header or toolbar action (thien, 7.4; docs/ui-standard.md › Nút và ô). Who shows the word is
 * decided here, not by the caller:
 * - the page's primary (orange) action always shows it, on every width;
 * - on a laptop any other action is its icon and opens to the word on hover;
 * - on a phone, where nothing hovers, an icon anyone reads (PLAIN_ICONS: add, filter, sort...)
 *   stands alone and any other icon keeps its word.
 */
export function ExpandingIconButton({
  icon: Icon,
  label,
  badge,
  className,
  variant = 'outline',
  size = 'default',
  ref,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  icon: LucideIcon;
  label: string;
  badge?: React.ReactNode;
}) {
  const word =
    variant === 'default'
      ? 'ml-1.5 whitespace-nowrap'
      : cn(
          OPENS,
          isPlainIcon(Icon)
            ? 'max-md:hidden'
            : 'max-md:ml-1.5 max-md:max-w-none max-md:opacity-100',
        );
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      className={cn('gap-0', className)}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span aria-hidden className={cn(word, 'group-data-[collapsible=icon]:hidden')}>
        {label}
      </span>
      {badge != null && <span className="ml-1 shrink-0">{badge}</span>}
    </Button>
  );
}
