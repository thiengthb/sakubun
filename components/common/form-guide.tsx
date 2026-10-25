'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/core/utils';

export type GuideItem = { term: string; text: ReactNode };

// What a form's fields take and what happens on send, under the form card instead of inside the
// inputs (thien, 2026-10-25: a placeholder is an example, not an explanation). Folded behind a
// "Hướng dẫn" button by default, so the page is not a wall of text; the button toggles it.
export function FormGuide({ items, className }: { items: GuideItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section aria-label="Hướng dẫn" className={cn('@container space-y-3', className)}>
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Lightbulb aria-hidden />
        Hướng dẫn
        <ChevronDown aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
      </Button>
      <dl
        id={id}
        hidden={!open}
        className="grid gap-x-8 gap-y-4 px-4 @2xl:grid-cols-2 @5xl:grid-cols-3"
      >
        {items.map((item) => (
          <div key={item.term} className="space-y-1">
            <dt className="text-sm font-semibold text-foreground">{item.term}</dt>
            <dd className="text-sm text-muted-foreground">{item.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A sample line in a guide, on a muted chip. */
export function GuideSample({ children }: { children: ReactNode }) {
  return (
    <code lang="ja" className="rounded-sm bg-muted px-1 py-0.5 font-sans text-foreground">
      {children}
    </code>
  );
}
