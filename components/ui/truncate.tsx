'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Explain } from '@/components/common/explain';
import { cn } from '@/lib/core/utils';

export function Truncate({
  children,
  full,
  className,
  side = 'bottom',
}: {
  children: ReactNode;
  full?: ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [check, children]);

  // On a card that opens a page the cut text rises above the card's link to show its tooltip
  // (LIST_CARD.linked), so a click on it follows that link itself.
  const follow = (e: MouseEvent<HTMLSpanElement>) => {
    const link = e.currentTarget
      .closest('li')
      ?.querySelector<HTMLAnchorElement>(':scope > a[href]');
    if (link && !e.defaultPrevented) link.click();
  };
  const span = (
    <span
      ref={ref}
      data-truncated={overflow || undefined}
      onClick={overflow ? follow : undefined}
      className={cn('block min-w-0 truncate', className)}
    >
      {children}
    </span>
  );

  if (!overflow) return span;

  return (
    <Explain text={full ?? children} side={side}>
      {span}
    </Explain>
  );
}
