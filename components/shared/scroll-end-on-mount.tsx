'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * A horizontally scrollable box that starts scrolled to its RIGHT end.
 *
 * For a time series drawn oldest-to-newest (the year activity heatmap), the default `scrollLeft: 0` shows
 * the OLDEST data and pushes today off-screen — on a phone, where the box is ~324px and the content is
 * ~830px, that means the one part the learner came for is the part they cannot see. Scrolling to the end
 * puts today at the right edge, exactly where it sits on a desktop that fits the whole year.
 *
 * Done in an effect rather than with CSS: there is no CSS way to say "start at the end" for LTR content
 * (`direction: rtl` would also reverse the grid's column order). `behavior: 'instant'` so it never
 * animates on load, and it runs once — a later user scroll is theirs to keep.
 */
export function ScrollEndOnMount({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'instant' });
  }, []);

  return (
    <div ref={ref} className={cn('overflow-x-auto', className)}>
      {children}
    </div>
  );
}
