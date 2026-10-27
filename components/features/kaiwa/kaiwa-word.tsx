'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SpokenLine } from '@/components/common/spoken-line';
import { useServerAction } from '@/components/common/use-server-action';
import { addWordAction } from '@/app/kaiwa/actions';
import type { WordMeaning } from '@/lib/kaiwa/lookup';

const OPEN_DELAY = 200;
const CLOSE_DELAY = 150;

// A word in a script with a known meaning (K5, from kaiwa-canvas): the mouse resting on it, a tap or
// Enter shows its Vietnamese meaning; a word from OpenJLPT can go into the learner's library.
export function KaiwaWord({ meaning, children }: { meaning: WordMeaning; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const add = useServerAction(addWordAction, {
    success: `Đã thêm ${meaning.expression} vào kho`,
    onSuccess: () => router.refresh(),
  });

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
        className="w-64"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
      >
        <div className="flex items-baseline gap-2">
          <SpokenLine
            text={meaning.expression}
            label="Nghe từ"
            className="text-base"
            aside={
              meaning.reading &&
              meaning.reading !== meaning.expression && (
                <span className="ml-1 text-xs text-muted-foreground">[{meaning.reading}]</span>
              )
            }
          />
          <Badge variant="outline" className="ml-auto">
            {meaning.level}
          </Badge>
        </div>
        <p>{meaning.meaningVi}</p>
        {meaning.itemId ? (
          <Link
            href={`/resources/${meaning.itemId}`}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Đã có trong kho của bạn
          </Link>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Nghĩa từ OpenJLPT</span>
            <Button
              variant="outline"
              onClick={() => add.run(meaning.expression)}
              disabled={add.isPending}
            >
              <BookPlus aria-hidden />
              Thêm vào kho
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
