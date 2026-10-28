'use client';

import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/common/explain';
import { isPlainIcon } from '@/lib/design/plain-icons';

/**
 * A button in a page's content (thien, 7.4; docs/ui-standard.md › Nút và ô): on a laptop its icon
 * alone, with a tooltip that says what it does; on a phone, where nothing hovers, an icon anyone
 * reads (PLAIN_ICONS) stands alone and any other icon keeps its word. Decided here, not by the
 * caller.
 */
export function IconAction({
  icon: Icon,
  label,
  className,
  variant = 'ghost',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size' | 'children'> & {
  icon: LucideIcon;
  /** What the button does, in a few words: the tooltip, the aria-label and the phone's word. */
  label: string;
}) {
  const plain = isPlainIcon(Icon);
  return (
    <Explain text={label}>
      <Button
        variant={variant}
        size={plain ? 'icon' : 'icon-word'}
        aria-label={label}
        className={className}
        {...props}
      >
        <Icon aria-hidden />
        {!plain && (
          <span aria-hidden className="md:hidden">
            {label}
          </span>
        )}
      </Button>
    </Explain>
  );
}
