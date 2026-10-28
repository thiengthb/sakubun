'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WordCard } from '@/components/common/word-card';
import type { WordMeaning } from '@/lib/kaiwa/lookup';

const OPEN_DELAY = 200;
const CLOSE_DELAY = 150;

// A word in a script with a known meaning (K5, from kaiwa-canvas): the mouse resting on it, a tap or
// Enter shows its card, the same card as the lookup on every other sentence (7.4b). The view mode
// redo (7.4e) moves Hội thoại onto that lookup.
export function KaiwaWord({ meaning, children }: { meaning: WordMeaning; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Only a mouse opens on rest; touch and pen open on the tap, as the trigger's click.
  const hover = (next: boolean) => (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), next ? OPEN_DELAY : CLOSE_DELAY);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    setOpen((o) => !o);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          data-slot="kaiwa-word"
          onPointerEnter={hover(true)}
          onPointerLeave={hover(false)}
          onKeyDown={key}
          className="cursor-help rounded-xs underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 hover:bg-accent-brand/10 focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-accent-brand/10"
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-72"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
      >
        <WordCard meaning={meaning} />
      </PopoverContent>
    </Popover>
  );
}
