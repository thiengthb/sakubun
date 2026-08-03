'use client';

import * as React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/shared/explain';
import { cn } from '@/lib/utils';

/**
 * The ONE control for a bulk (selection) action: an ICON-ONLY button whose name appears in a hover /
 * focus tooltip. Every action in the DataTable's selection dock uses it, so the dock stays a narrow
 * icon column pinned to the right edge (user ask 2026-07-25) while each action is still named — for the
 * eye on hover, and for assistive tech through the always-present `aria-label`.
 *
 * While `pending`, the icon swaps for a spinner and the tooltip shows `pendingLabel` (the icon-only
 * replacement for the old "Đang xóa…" text labels).
 *
 * Works as a Radix `asChild` trigger (`BulkGroupButton` mounts it inside a `DropdownMenuTrigger`): the
 * merged trigger props + ref are forwarded down to the Button, and the Tooltip composes with them.
 */
export function BulkActionButton({
  icon: Icon,
  label,
  pendingLabel,
  pending = false,
  side = 'left',
  variant = 'outline',
  size = 'icon',
  className,
  disabled,
  ref,
  ...props
}: React.ComponentProps<typeof Button> & {
  icon: LucideIcon;
  /** The action's name — tooltip text AND accessible name. */
  label: string;
  /** Tooltip text while the action runs (defaults to `label`). */
  pendingLabel?: string;
  pending?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const name = pending ? (pendingLabel ?? label) : label;

  return (
    <Explain side={side} text={name}>
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={name}
        disabled={disabled || pending}
        className={cn(className)}
        {...props}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <Icon className="size-4" aria-hidden />
        )}
      </Button>
    </Explain>
  );
}
