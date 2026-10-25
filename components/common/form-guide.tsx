import type { ReactNode } from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/core/utils';

export type GuideItem = { term: string; text: ReactNode };

// What a form's fields take and what happens on send, written under the form card instead of inside
// the inputs (thien, 2026-10-25: a placeholder is an example, not an explanation; the space under
// a form on a laptop is where explanations go).
export function FormGuide({ items, className }: { items: GuideItem[]; className?: string }) {
  return (
    <section aria-label="Hướng dẫn" className={cn('@container px-4', className)}>
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Lightbulb className="size-4 text-muted-foreground" aria-hidden />
        Hướng dẫn
      </p>
      <dl className="mt-3 grid gap-x-8 gap-y-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
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
