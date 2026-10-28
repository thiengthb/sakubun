'use client';

import { useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

const CLOSE_DELAY = 150;

/** One shortcut: its keys as the learner presses them, and what it does. */
export type Shortcut = { keys: string[]; does: string };

// The page's shortcuts behind one `?` at the end of the header (thien, 7.4 round 3): the mouse
// resting on it, focus or a tap shows the list, so no button carries a key in its face.
export function ShortcutsHelp({ shortcuts }: { shortcuts: readonly Shortcut[] }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = (next: boolean) => {
    clearTimeout(timer.current);
    if (next) setOpen(true);
    else timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };
  const enter = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') show(true);
  };
  const leave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') show(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Phím tắt"
          aria-expanded={open}
          onPointerEnter={enter}
          onPointerLeave={leave}
          onFocus={() => show(true)}
          onBlur={() => show(false)}
          onClick={() => setOpen((o) => !o)}
        >
          <CircleHelp />
        </Button>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        className="w-auto max-w-xs"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={enter}
        onPointerLeave={leave}
      >
        <p className="mb-2 text-xs font-medium text-muted-foreground">Phím tắt</p>
        <dl
          data-slot="shortcuts"
          className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5"
        >
          {shortcuts.map((s) => (
            <div key={s.does} className="contents">
              <dt className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-6 rounded-sm border border-border bg-card px-1.5 py-0.5 text-center font-sans text-xs font-medium"
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="text-sm">{s.does}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
