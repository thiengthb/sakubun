'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Explain } from '@/components/shared/explain';
import { cn } from '@/lib/utils';

/**
 * SMART single-line truncate: only shows the tooltip when the text actually overflows — no
 * pointless tooltip for short text. The tooltip shows the full content right below the cursor
 * (default side "bottom"). Overflow is measured via scrollWidth + ResizeObserver.
 */
export function Truncate({
  children,
  full,
  className,
  side = 'bottom',
}: {
  children: ReactNode;
  /** full content shown in the tooltip; defaults to children (use when children is a string) */
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

  const span = (
    <span ref={ref} className={cn('block min-w-0 truncate', className)}>
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
