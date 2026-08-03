'use client';

import type { ReactNode } from 'react';
import { CopyCommandButton } from '@/components/shared/copy-command-button';

// Building blocks for the /guide REFERENCE sections (the prose under each interactive walkthrough).
// Sibling of `guide-primitives.tsx`, which holds the mockup art used INSIDE the walkthroughs.
// Server-rendered, no state of their own. (The collapsible feature TOPIC used to live here too; it
// moved to `guide-search.tsx` when the tour became searchable — a topic's trigger now reads its
// title/summary from the `guide-topic-meta.ts` registry instead of taking them as props.)

/**
 * A pasteable block. `copyLabel` adds a corner copy button — for the two Claude Desktop config blocks,
 * where retyping or hand-selecting 12 lines of JSON is the actual friction. Reuses the shared
 * `CopyCommandButton` (icon-only, and told not to echo the whole block into the toast).
 */
export function Code({ children, copyLabel }: { children: string; copyLabel?: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-border/70 bg-muted/40 p-4 text-xs">
        <code>{children}</code>
      </pre>
      {copyLabel && (
        <CopyCommandButton
          command={children}
          label={copyLabel}
          size="icon-sm"
          showCopiedText={false}
          toastDescription="none"
          className="absolute top-2 right-2"
        />
      )}
    </div>
  );
}

/** Small header above a reference block that sits under an interactive walkthrough. */
export function RefHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}
