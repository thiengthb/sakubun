'use client';

import * as React from 'react';
// From `radix-ui`, NOT `@radix-ui/react-slot` — see the Slottable note in the doc comment below.
import { type LucideIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A compact action button that shows ONLY its icon at rest and reveals its label — sliding the button
 * wider — on hover / keyboard focus / while its menu is open (aria-expanded). Used for the toolbar
 * actions (Bộ lọc / Nhập). Keeps an always-present `aria-label` so the control is named for
 * assistive tech even while the text is visually collapsed. `motion-reduce` drops the slide (label
 * just appears). Works as a Radix `asChild` trigger — it forwards ref + the merged trigger props to
 * the underlying Button, and the expand keys off the Button's own `group/button` + its aria-expanded.
 *
 * It also accepts `asChild` ITSELF, to render as a link (`<ExpandingIconButton asChild><Link/></…>`).
 * That needs `<Slottable>`: with `asChild`, Button becomes a Radix `Slot`, and a bare Slot demands
 * exactly ONE element child — this component always renders two or three (icon, label, badge), so it
 * threw "Slot failed to slot onto its children" and the whole page fell to the error boundary. Wrapping
 * the caller's element in `Slottable` tells Slot which child to merge the props into and makes the rest
 * that element's children, so the icon + label end up INSIDE the `<a>` and it stays one tap target.
 * Outside a Slot (the normal, non-asChild path) `Slottable` is a plain fragment around `undefined`, so
 * it renders nothing.
 *
 * `Slottable` MUST come from the same package as the `Slot` that Button uses (`radix-ui`, the unified
 * package) — not from `@radix-ui/react-slot`. Both are installed at different versions, and Slot
 * recognises a Slottable by a `Symbol()` created per module instance, so a Slottable from the other copy
 * is silently NOT recognised and Slot throws exactly as if it were not there. That cost a debugging
 * round: the fix looked correct, the error was byte-identical, only the digest changed.
 *
 * BELOW md THE LABEL NEVER EXPANDS (2026-08-04) — icon only, permanently. Two reasons: there is no
 * hover on touch, so the expand only ever fired on tap, i.e. exactly when the user had already decided
 * and the widening just shoved the rest of the toolbar sideways; and the toolbar shares one row with
 * the search box, where every reclaimed pixel goes to the input. The name still reaches assistive tech
 * through `aria-label`.
 */
export function ExpandingIconButton({
  icon: Icon,
  label,
  badge,
  className,
  variant = 'outline',
  // h-8 (the Button `default` size) so every toolbar action button lines up with the search box
  // (`SearchInput` → `Input` is h-8). A caller can still pass an explicit `size` to override.
  size = 'default',
  ref,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  icon: LucideIcon;
  label: string;
  /** Optional always-visible trailing content (e.g. an active-filter count badge). */
  badge?: React.ReactNode;
}) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={cn('gap-0', className)}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span
        aria-hidden
        // On a collapsed sidebar icon rail the label is force-hidden (the class is a no-op anywhere
        // that isn't a `collapsible=icon` sidebar, so toolbar usages are unaffected).
        className="max-md:hidden max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover/button:ml-1.5 group-hover/button:max-w-40 group-hover/button:opacity-100 group-focus-visible/button:ml-1.5 group-focus-visible/button:max-w-40 group-focus-visible/button:opacity-100 group-aria-[expanded=true]/button:ml-1.5 group-aria-[expanded=true]/button:max-w-40 group-aria-[expanded=true]/button:opacity-100 group-data-[collapsible=icon]:hidden motion-reduce:transition-none"
      >
        {label}
      </span>
      {badge != null && <span className="ml-1 shrink-0">{badge}</span>}
    </Button>
  );
}
