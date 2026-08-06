'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { ChevronLeft, ChevronRight, Info, Settings2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Explain } from '@/components/shared/explain';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { cn } from '@/lib/utils';

/**
 * The app's card deck — one card at a time, tap to flip, SWIPE (or the arrows, or ← →) to move through
 * the pile. Quizlet's flashcard screen is the reference, and the important part of that reference is
 * what it does NOT have: no grading buttons under the card, no instruction line. Moving is the only
 * verb, so the gesture can be the whole interface and the card gets the screen.
 *
 * Shared by the group deck (components/groups/group-flashcards.tsx) and the history deck
 * (components/history/history-flashcards.tsx) so both feel like the same object. It owns the pile —
 * position, flip, gesture, keyboard, the two faces — and NOTHING about what a card says; the caller
 * renders `front`/`back` and keeps its own settings in `toolbar`.
 *
 * State lives in `useCardDeck()` in the CALLER, not in here. That is deliberate: the caller needs to
 * read the position (which card auto-reads, and on which face) and to reset it (shuffle, replay), and
 * a deck that owned its own index would have to be remounted for that — which would tear down the
 * caller's settings popover mid-interaction.
 *
 * Never touches FSRS. A deck is a way to LOOK at cards; scheduling stays with submitReview().
 */

export interface CardDeckState {
  /** Which card is on top. Always a real card while there is one — see `done` for the end of the pile. */
  index: number;
  count: number;
  flipped: boolean;
  /** Which way the last move went; the enter/exit slide reads it so a card comes in from the side you came from. */
  dir: 1 | -1;
  /** Swiped PAST the last card. Reached by moving, never by the pile changing size underneath you. */
  done: boolean;
  atStart: boolean;
  next: () => void;
  prev: () => void;
  flip: () => void;
  restart: () => void;
}

export function useCardDeck(count: number): CardDeckState {
  const [pos, setPos] = useState<{ index: number; dir: 1 | -1; done: boolean }>({
    index: 0,
    dir: 1,
    done: false,
  });
  const [flipped, setFlipped] = useState(false);

  const last = Math.max(0, count - 1);
  // Clamped on READ, not by an effect chasing `count`: the pile changes size under the reader all the
  // time (a filter narrows on /history, an item leaves a group), and a stale index would read past the
  // end for one render.
  const index = Math.min(pos.index, last);

  // `done` is its OWN flag rather than `index === count`, and that distinction is the whole fix for a
  // bug measured on 2026-08-06: searching /history down to one row while sitting on card 2 made the
  // index-as-end encoding read "past the end", so narrowing a filter dropped the learner onto the
  // finished screen instead of onto the one card they had just searched for. Running out of cards and
  // being handed fewer cards are different events; only the first one ends the deck.
  const move = useCallback(
    (delta: 1 | -1) => {
      setPos((p) => {
        const cur = Math.min(p.index, last);
        if (delta > 0) {
          if (p.done) return p;
          return cur >= last
            ? { index: cur, dir: 1, done: true }
            : { index: cur + 1, dir: 1, done: false };
        }
        if (p.done) return { index: cur, dir: -1, done: false };
        return cur === 0 ? p : { index: cur - 1, dir: -1, done: false };
      });
      // A new card always starts face down — otherwise swiping while flipped shows the next answer first.
      setFlipped(false);
    },
    [last],
  );

  const next = useCallback(() => move(1), [move]);
  const prev = useCallback(() => move(-1), [move]);
  const flip = useCallback(() => setFlipped((f) => !f), []);
  const restart = useCallback(() => {
    setPos({ index: 0, dir: 1, done: false });
    setFlipped(false);
  }, []);

  return {
    index,
    count,
    flipped,
    dir: pos.dir,
    done: pos.done,
    atStart: !pos.done && index === 0,
    next,
    prev,
    flip,
    restart,
  };
}

/** The deck's controls, stated once. Mirrors the global keydown handler in `<CardDeck>` below. */
const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Vuốt ngang', action: 'Chuyển thẻ' },
  { keys: 'Space / Enter', action: 'Lật thẻ' },
  { keys: '→', action: 'Thẻ sau' },
  { keys: '←', action: 'Thẻ trước' },
];

/**
 * An info icon whose hover tooltip lists every shortcut. Meant for the deck's `corner` slot, so the
 * guide is one hover away instead of a permanent instruction line under the card — which is the line
 * that got removed on 2026-08-06 for being furniture the learner reads once and then scrolls past
 * forever.
 */
export function DeckShortcutsInfo() {
  return (
    <Explain
      side="bottom"
      align="end"
      className="w-52 flex-col items-stretch gap-1 py-2"
      text={
        <>
          <p className="mb-0.5 font-medium">Cách dùng</p>
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-3">
              <span className="text-background/70">{s.action}</span>
              <span className="rounded bg-background/15 px-1.5 py-0.5 font-medium">{s.keys}</span>
            </div>
          ))}
        </>
      }
    >
      <button
        type="button"
        aria-label="Cách dùng thẻ"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
    </Explain>
  );
}

/**
 * Panel cài đặt của deck: nút bánh xe ở hàng trên, mở ra một popover 256px.
 *
 * Gom 2026-08-07: hai deck (nhóm + lịch sử) viết ra cùng một popover với cùng một trigger, và
 * `dup-scan` đếm 7 cửa sổ trùng giữa chúng — trùng lặp do CHÍNH TÔI tạo ra khi viết deck lịch sử
 * cùng ngày hôm trước. Nội dung bên trong vẫn của từng deck (chiều thẻ chỉ nhóm mới có).
 */
export function DeckSettings({ children }: { children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ExpandingIconButton icon={Settings2} label="Cài đặt" variant="outline" size="sm" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-4">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Một hàng công tắc trong `<DeckSettings>`.
 *
 * `hint` đổi cả cách canh hàng, và đó là toàn bộ khác biệt giữa hai hàng đang có: hàng không có chú
 * thích canh giữa theo trục dọc, hàng CÓ chú thích canh theo đỉnh để công tắc thẳng với dòng đầu chứ
 * không trôi xuống giữa đoạn hai dòng.
 */
export function DeckSwitchRow({
  icon: Icon,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  /** Câu giải thích dưới nhãn. Có nó thì hàng canh theo đỉnh. */
  hint?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex justify-between gap-3', hint ? 'items-start' : 'items-center')}>
      <span className={cn('flex gap-2 text-sm', hint ? 'items-start' : 'items-center')}>
        <Icon className={cn('size-4 text-muted-foreground', hint && 'mt-0.5 shrink-0')} />
        {hint ? (
          <span className="flex flex-col leading-tight">
            {label}
            <span className="text-xs font-normal text-muted-foreground">{hint}</span>
          </span>
        ) : (
          label
        )}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className={hint ? 'mt-0.5' : undefined}
      />
    </label>
  );
}

/** Fisher–Yates on a copy. Shared by both decks' shuffle toggle. */
export function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// The card slides out the way you pushed it and the next one comes in from the far side — the motion
// that makes a pile read as a pile. `pointerEvents: none` on the way out so the leaving card cannot
// swallow a tap meant for its replacement during the ~280ms both are mounted.
const SLIDE = {
  enter: (dir: number) => ({ x: dir > 0 ? '55%' : '-55%', opacity: 0 }),
  center: { x: 0, opacity: 1, pointerEvents: 'auto' as const },
  exit: (dir: number) => ({
    x: dir > 0 ? '-55%' : '55%',
    opacity: 0,
    pointerEvents: 'none' as const,
  }),
};

/**
 * How far a drag must travel to count as a swipe. Velocity is folded in so a quick flick moves the
 * deck without crossing the distance — the same trade every carousel makes, and the reason a slow,
 * deliberate half-drag springs back instead: at that speed you were reading, not swiping.
 */
const SWIPE_PX = 56;
const FLICK_WEIGHT = 0.15;

const faceCls =
  'absolute inset-0 overflow-y-auto rounded-2xl bg-card p-5 ring-1 ring-foreground/10 [backface-visibility:hidden]';

export function CardDeck({
  deck,
  cardKey,
  front,
  back,
  corner,
  toolbar,
  done,
  unit = 'Thẻ',
  className,
}: {
  deck: CardDeckState;
  /** Stable id of the card on top — the key the enter/exit animation is driven by. */
  cardKey: string;
  front: ReactNode;
  back: ReactNode;
  /** Overlay pinned to the card's top-right. Sits ABOVE the flip, so it never rotates with the face. */
  corner?: ReactNode;
  /** The caller's own controls for the top bar (a settings popover, a mode switch). */
  toolbar?: ReactNode;
  /** What replaces the card once you swipe past the last one. */
  done: ReactNode;
  /** Counter noun — "Thẻ 3 / 12" for a group, "Lượt 3 / 12" for history. */
  unit?: string;
  className?: string;
}) {
  const { next, prev, flip } = deck;
  // A drag that moved is not a tap. Motion fires `click` after a drag ends, so without this every swipe
  // would also flip the card it just left.
  const draggedRef = useRef(false);

  // Space/Enter flips · ← → move · Backspace goes back. Global rather than on the card, so the deck
  // responds without the learner having to focus it first — the whole screen IS the deck.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return;
      // A modal (the enrich / detail dialog) is open — let it own the keyboard rather than moving the
      // deck behind it.
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        prev();
      } else if ((e.key === ' ' || e.key === 'Enter') && tag !== 'button') {
        // Not while a button has focus: Space/Enter is that button's own activation key.
        e.preventDefault();
        flip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, flip]);

  const onDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      const power = info.offset.x + info.velocity.x * FLICK_WEIGHT;
      if (power <= -SWIPE_PX) next();
      else if (power >= SWIPE_PX) prev();
    },
    [next, prev],
  );

  // Cards LEFT BEHIND, so the bar is empty on the first card and full only past the last one.
  const pct = deck.done ? 100 : deck.count ? Math.round((deck.index / deck.count) * 100) : 0;

  return (
    // Fills the screen vertically — the card is the thing being read, so it gets everything left over
    // after the counter row, the progress bar and the nav row. `svh`, not `vh`, so a phone's collapsing
    // address bar never clips the arrows.
    //
    // Capped horizontally and centred. Full-bleed, a card on a 1440px screen is a 1160px sheet with one
    // word floating in the middle of it — the eye has to travel to find the thing it is testing itself
    // on. A reading-width column keeps the term where the eyes already are. (A phone is far below the
    // cap, so this changes nothing there.)
    <div
      className={cn(
        'mx-auto flex min-h-[calc(100svh-6rem)] w-full max-w-4xl flex-col gap-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {deck.done ? (
            <span>Hết thẻ</span>
          ) : (
            <span>
              {unit} <b className="text-foreground">{deck.index + 1}</b> / {deck.count}
            </span>
          )}
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {deck.done ? (
        <div className="flex-1">{done}</div>
      ) : (
        <div className="relative min-h-[15rem] w-full flex-1 [perspective:1600px]">
          <AnimatePresence initial={false} custom={deck.dir}>
            {/* Two nested motion divs on purpose: the OUTER one carries the swipe + the deck slide (x),
                the INNER one carries the flip (rotateY). One element cannot animate both, because the
                slide and the flip are driven by different state and have different durations. The outer
                keeps `preserve-3d` so it does not flatten the flip happening inside it. */}
            <motion.div
              key={cardKey}
              custom={deck.dir}
              variants={SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: EASE_OUT }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.22}
              dragMomentum={false}
              onPointerDownCapture={() => {
                draggedRef.current = false;
              }}
              onDrag={(_e, info) => {
                if (Math.abs(info.offset.x) > 6) draggedRef.current = true;
              }}
              onDragEnd={onDragEnd}
              className="absolute inset-0 cursor-grab active:cursor-grabbing [transform-style:preserve-3d]"
            >
              {/* A div with role=button, NOT a <button>: the faces contain real <button>s (play, enrich)
                  and a button cannot nest a button. Keyboard flip is the global handler above. */}
              <motion.div
                role="button"
                tabIndex={0}
                aria-label={deck.flipped ? 'Lật lại mặt trước' : 'Lật xem mặt sau'}
                onClick={(e) => {
                  if (draggedRef.current) return; // that was a swipe
                  if ((e.target as HTMLElement).closest('button, a')) return;
                  flip();
                }}
                className="relative h-full w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary [transform-style:preserve-3d]"
                animate={{ rotateY: deck.flipped ? 180 : 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              >
                <div className={cn(faceCls, 'flex flex-col items-center justify-center gap-2')}>
                  {front}
                </div>
                <div className={cn(faceCls, '[transform:rotateY(180deg)]')}>{back}</div>
              </motion.div>

              {corner && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">{corner}</div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* The only two controls under the card. 44px circles — a thumb target, and the same shape at
          every width because a phone is where the swipe lives and a mouse is where the arrows do. */}
      <div className="flex items-center justify-center gap-6">
        <Button
          variant="outline"
          size="icon-lg"
          className="size-11 rounded-full"
          onClick={prev}
          disabled={deck.atStart}
          aria-label="Thẻ trước"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          className="size-11 rounded-full"
          onClick={next}
          disabled={deck.done}
          aria-label="Thẻ sau"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </div>
  );
}
