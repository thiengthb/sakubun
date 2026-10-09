'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/core/utils';

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
