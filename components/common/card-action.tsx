'use client';

import type { ComponentProps, MouseEvent } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Explain } from '@/components/common/explain';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/core/utils';

// A button on a card in a list (thien, 7.4): only its icon, so the card keeps its room for the
// content; what it does is in the tooltip on hover or focus, which is also its accessible name.
// Because the tooltip always says it, any icon may stand here (docs/ui-standard.md, Thẻ).
export function CardAction({
  icon: Icon,
  label,
  href,
  onClick,
  className,
  ...props
}: {
  icon: LucideIcon;
  /** What the button does, in a few words: the tooltip and the aria-label. */
  label: string;
  /** A link instead of a button (e.g. "Đã có" opens the learner's copy). */
  href?: string;
  onClick?: (e: MouseEvent) => void;
  className?: string;
} & Pick<ComponentProps<'button'>, 'disabled' | 'aria-pressed'>) {
  const classes = cn('text-muted-foreground hover:text-foreground', className);
  // A card is often a link as a whole: its buttons act on their own.
  const click = (e: MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
  };
  return (
    <Explain text={label}>
      {href ? (
        <Button variant="ghost" size="icon" className={classes} asChild>
          <Link href={href} aria-label={label} onClick={(e) => e.stopPropagation()}>
            <Icon aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={click}
          className={classes}
          {...props}
        >
          <Icon aria-hidden />
        </Button>
      )}
    </Explain>
  );
}
