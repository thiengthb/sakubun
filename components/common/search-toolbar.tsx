'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';

// thien, 2026-10-24: on a phone the search grows to the list's full width while it is in use
// (focused, or holding a query), and the tools beside it (sort, filter) slide to a row below,
// where they share its full width equally (thien, 2026-10-25).
// The first paint is a plain flex row; once the tools are measured the row switches to the
// positioned layout below, which looks the same at rest and can animate.
const MEASURED = {
  bar: 'max-md:relative max-md:block max-md:transition-[padding] max-md:duration-200 max-md:ease-out max-md:has-[input:focus]:pb-(--tb-pad) max-md:has-[input:not(:placeholder-shown)]:pb-(--tb-pad) motion-reduce:transition-none',
  search:
    'max-md:w-(--tb-rest) max-md:max-w-none max-md:transition-[width] max-md:duration-200 max-md:ease-out max-md:group-has-[input:focus]/toolbar:w-full max-md:group-has-[input:not(:placeholder-shown)]/toolbar:w-full motion-reduce:transition-none',
  tools:
    'max-md:absolute max-md:top-0 max-md:right-0 max-md:w-(--tb-tools) max-md:transition-[width,translate] max-md:duration-200 max-md:ease-out max-md:group-has-[input:focus]/toolbar:w-full max-md:group-has-[input:focus]/toolbar:translate-y-(--tb-down) max-md:group-has-[input:focus]/toolbar:*:flex-1 max-md:group-has-[input:focus]/toolbar:[&_button]:w-full max-md:group-has-[input:not(:placeholder-shown)]/toolbar:w-full max-md:group-has-[input:not(:placeholder-shown)]/toolbar:translate-y-(--tb-down) max-md:group-has-[input:not(:placeholder-shown)]/toolbar:*:flex-1 max-md:group-has-[input:not(:placeholder-shown)]/toolbar:[&_button]:w-full motion-reduce:transition-none',
} as const;

const GAP = '0.5rem'; // gap-2, the row's gap on a phone

export function SearchToolbar({
  lead,
  search,
  children,
}: {
  /** Shown before the search from 1024px (the table's view switch). */
  lead?: ReactNode;
  search?: ReactNode;
  /** The tools on the right: sort, filter, columns, actions. */
  children: ReactNode;
}) {
  const searchRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ search: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const box = searchRef.current;
    const tools = toolsRef.current;
    if (!box || !tools) return;
    const measure = () => {
      // The tools' resting size; while the search is in use they are stretched across the row.
      if (tools.parentElement?.matches(':has(input:focus), :has(input:not(:placeholder-shown))'))
        return;
      const next = { search: box.offsetHeight, w: tools.offsetWidth, h: tools.offsetHeight };
      setSize((s) =>
        s && s.search === next.search && s.w === next.w && s.h === next.h ? s : next,
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(tools);
    return () => ro.disconnect();
  }, []);

  const measured = search != null && size != null && size.w > 0;
  const style = measured
    ? ({
        '--tb-rest': `calc(100% - ${size.w}px - ${GAP})`,
        '--tb-tools': `${size.w}px`,
        '--tb-pad': `calc(${size.h}px + ${GAP})`,
        '--tb-down': `calc(${size.search}px + ${GAP})`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      data-slot="search-toolbar"
      className={cn(
        'group/toolbar flex flex-row items-center gap-2 sm:gap-3',
        measured && MEASURED.bar,
      )}
      style={style}
    >
      {lead}
      {search != null && (
        <div
          ref={searchRef}
          className={cn('min-w-0 flex-1 sm:max-w-xs', measured && MEASURED.search)}
        >
          {search}
        </div>
      )}
      <div
        ref={toolsRef}
        className={cn('flex shrink-0 items-center gap-2 md:ml-auto', measured && MEASURED.tools)}
      >
        {children}
      </div>
    </div>
  );
}
