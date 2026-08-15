'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Settings2,
  Shuffle,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Explain } from '@/components/common/explain';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { useSessionState } from '@/components/common/use-session-state';
import { cn } from '@/lib/core/utils';

export interface CardDeckState {
  index: number;
  count: number;
  flipped: boolean;
  dir: 1 | -1;
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
  const index = Math.min(pos.index, last);

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

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Vuốt ngang', action: 'Chuyển thẻ' },
  { keys: 'Space / Enter', action: 'Lật thẻ' },
  { keys: '→', action: 'Thẻ sau' },
  { keys: '←', action: 'Thẻ trước' },
];

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

export function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface DeckOrder<T> {
  cards: T[];
  deck: CardDeckState;
  shuffle: boolean;
  toggleShuffle: (on: boolean) => void;
  replay: (reshuffle: boolean) => void;
}

// The order + restart machine both decks run: an optional shuffled permutation over a stable list
// of ids, with "học lại từ đầu" and "trộn rồi học lại" resetting the deck.
//
// `keyOf` must be referentially stable (declare it at module scope) — it is a dependency of the
// memo that builds the visible card list.
//
// Items missing from a stale order sort to the END rather than vanishing: the history deck's pool
// changes whenever a filter changes, and dropping the newly-matching rows mid-shuffle would silently
// shrink the deck.
export function useDeckOrder<T>(items: T[], keyOf: (item: T) => string): DeckOrder<T> {
  const [order, setOrder] = useState<string[] | null>(null);
  const [shuffle, setShuffle] = useState(false);

  const ids = useMemo(() => items.map(keyOf), [items, keyOf]);
  const cards = useMemo(() => {
    if (!order) return items;
    const rank = new Map(order.map((id, i) => [id, i]));
    return [...items].sort(
      (a, b) =>
        (rank.get(keyOf(a)) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(keyOf(b)) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [items, order, keyOf]);

  const deck = useCardDeck(cards.length);

  const toggleShuffle = useCallback(
    (on: boolean) => {
      setShuffle(on);
      setOrder(on ? shuffled(ids) : null);
      deck.restart();
    },
    [ids, deck],
  );

  const replay = useCallback(
    (reshuffle: boolean) => {
      if (reshuffle) {
        setShuffle(true);
        setOrder(shuffled(ids));
      }
      deck.restart();
    },
    [ids, deck],
  );

  return { cards, deck, shuffle, toggleShuffle, replay };
}

// "Tự đọc tiếng Nhật" is one preference across every deck, so it lives under one session key.
export function useAutoSpeak(): [boolean, (on: boolean) => void] {
  return useSessionState('flashcards.autoSpeak', false);
}

// The two switches every deck offers. `autoSpeakHint` differs per deck because what gets read aloud
// depends on that deck's card faces.
export function DeckCommonSettings({
  order,
  autoSpeak,
  onAutoSpeakChange,
  autoSpeakHint,
  children,
}: {
  order: DeckOrder<unknown>;
  autoSpeak: boolean;
  onAutoSpeakChange: (on: boolean) => void;
  autoSpeakHint: ReactNode;
  children?: ReactNode;
}) {
  return (
    <DeckSettings>
      {children}
      <DeckSwitchRow
        icon={Shuffle}
        label="Trộn thẻ"
        checked={order.shuffle}
        onCheckedChange={order.toggleShuffle}
        disabled={order.cards.length < 2}
      />
      <DeckSwitchRow
        icon={Volume2}
        label="Tự đọc tiếng Nhật"
        hint={autoSpeakHint}
        checked={autoSpeak}
        onCheckedChange={onAutoSpeakChange}
      />
    </DeckSettings>
  );
}

// The end-of-deck panel, identical across decks apart from the icon, the unit and the hint.
export function DeckDone({
  icon: Icon,
  count,
  unit,
  hint,
  onReplay,
}: {
  icon?: LucideIcon;
  count: number;
  unit: string;
  hint: ReactNode;
  onReplay: (reshuffle: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
      {Icon && <Icon className="size-8 text-primary" aria-hidden />}
      <div className="space-y-1">
        <p className="text-lg font-semibold">
          Đã lướt hết {count} {unit}
        </p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => onReplay(false)}>Học lại từ đầu</Button>
        {count > 1 && (
          <Button variant="outline" onClick={() => onReplay(true)}>
            Trộn rồi học lại
          </Button>
        )}
      </div>
    </div>
  );
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const SLIDE = {
  enter: (dir: number) => ({ x: dir > 0 ? '55%' : '-55%', opacity: 0 }),
  center: { x: 0, opacity: 1, pointerEvents: 'auto' as const },
  exit: (dir: number) => ({
    x: dir > 0 ? '-55%' : '55%',
    opacity: 0,
    pointerEvents: 'none' as const,
  }),
};

const SWIPE_PX = 56;
const FLICK_WEIGHT = 0.15;

// How far you must pull before the card behind has fully risen. Deliberately larger than SWIPE_PX:
// the stack finishes settling just after the throw commits, so the commit point is something you
// feel rather than a number you have to know.
const PULL_RANGE = 170;

// Two cards peek out behind the live one. They are narrowed on X only and pushed DOWN: a uniformly
// scaled card is smaller on every side, so it hides completely behind the one in front and the
// stack is invisible. Narrow + offset is what a real pile looks like, and the offset is the only
// thing that peeks, which keeps the overhang a fixed number of pixels instead of a share of an
// unknown card height.
const GHOST_COUNT = 2;
const GHOST_STEP = 0.04; // width removed per card down the stack
const GHOST_GAP = 8; // px each card sits below the one above it

// shadow-md, not just a ring: the live card has to sit visibly ON the pile behind it.
const faceCls =
  'absolute inset-0 overflow-y-auto rounded-2xl bg-card p-5 shadow-md ring-1 ring-foreground/10 [backface-visibility:hidden]';

export function CardDeck({
  deck,
  cardKey,
  front,
  back,
  corner,
  toolbar,
  done,
  unit = 'Thẻ',
  inlineProgress = false,
  className,
}: {
  deck: CardDeckState;
  cardKey: string;
  front: ReactNode;
  back: ReactNode;
  corner?: ReactNode;
  toolbar?: ReactNode;
  inlineProgress?: boolean;
  done: ReactNode;
  unit?: string;
  className?: string;
}) {
  const { next, prev, flip } = deck;
  const draggedRef = useRef(false);

  // How far the live card has been pulled. Everything behind it reads from this one value, so the
  // stack responds to the finger continuously instead of jumping when the swipe commits.
  const dragX = useMotionValue(0);
  const pull = useTransform(dragX, (v) => Math.min(1, Math.abs(v) / PULL_RANGE));
  const tilt = useTransform(dragX, [-PULL_RANGE, 0, PULL_RANGE], [-8, 0, 8]);
  const lift = useTransform(pull, [0, 1], [0, -10]);
  // The card directly behind rises to meet the one being thrown.
  const nextScaleX = useTransform(pull, [0, 1], [1 - GHOST_STEP, 1]);
  const nextY = useTransform(pull, [0, 1], [GHOST_GAP, 0]);
  const nextOpacity = useTransform(pull, [0, 1], [0.55, 1]);

  const settle = useCallback(() => {
    animate(dragX, 0, { type: 'spring', stiffness: 320, damping: 34 });
  }, [dragX]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        prev();
      } else if ((e.key === ' ' || e.key === 'Enter') && tag !== 'button') {
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
      // Either way the pull unwinds: on a throw the card is leaving anyway, and the one behind is
      // already at full size, so unwinding is invisible. On a failed throw it is the snap back.
      settle();
    },
    [next, prev, settle],
  );

  const pct = deck.done ? 100 : deck.count ? Math.round((deck.index / deck.count) * 100) : 0;

  const progressBar = (
    <div
      role="progressbar"
      aria-label="Tiến độ chồng thẻ"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn(
        'h-3 overflow-hidden rounded-full bg-muted',
        inlineProgress ? 'min-w-24 flex-1' : 'w-full',
      )}
    >
      {/* scaleX, not width: width re-lays-out the bar every frame, transform does not. */}
      <motion.div
        className="h-full w-full origin-left rounded-full bg-primary"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );

  return (
    <div
      className={cn(
        // overflow-x-clip, not hidden: a card dragged to the RIGHT extends the document and gives
        // the phone a horizontal scrollbar (measured: 179px). `clip` cuts it at the deck's edge
        // without turning this into a scroll container, and leaves the Y axis visible so the pile
        // behind can still peek out below.
        'mx-auto flex min-h-[calc(100svh-6rem)] w-full max-w-4xl flex-col gap-3 overflow-x-clip',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="shrink-0 text-sm text-muted-foreground">
          {deck.done ? (
            <span>Hết thẻ</span>
          ) : (
            <span>
              {unit} <b className="text-foreground">{deck.index + 1}</b> / {deck.count}
            </span>
          )}
        </div>
        {inlineProgress && progressBar}
        {toolbar && (
          <div className={cn('flex items-center gap-2', !inlineProgress && 'ml-auto')}>
            {toolbar}
          </div>
        )}
      </div>

      {!inlineProgress && progressBar}

      {deck.done ? (
        <div className="flex-1">{done}</div>
      ) : (
        // The stage is narrower than the page. At the column's full 4xl a single vocabulary word sat
        // in a 900px slab, which reads as an empty panel rather than a card; the toolbar and the
        // progress bar still span the full width above it.
        <div className="relative mx-auto min-h-[15rem] w-full max-w-2xl flex-1 [perspective:1600px]">
          {/* The rest of the deck. Purely decorative — aria-hidden and non-interactive — but it is
              what makes the pile look finite: you can see how much is left behind the card. */}
          {Array.from({ length: Math.min(GHOST_COUNT, deck.count - deck.index - 1) }, (_, i) => (
            <motion.div
              key={i}
              aria-hidden
              className="pointer-events-none absolute inset-0 origin-top rounded-2xl bg-card ring-1 ring-foreground/10"
              style={
                i === 0
                  ? { scaleX: nextScaleX, y: nextY, opacity: nextOpacity }
                  : {
                      scaleX: 1 - GHOST_STEP * (i + 1),
                      y: GHOST_GAP * (i + 1),
                      opacity: 0.55 - i * 0.2,
                    }
              }
            />
          ))}
          <AnimatePresence initial={false} custom={deck.dir}>
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
              // 0.22 meant a 100px pull moved the card 22px — you were nudging it, not holding it.
              // At 0.85 the card tracks the finger, which is the whole point of dragging a deck.
              dragElastic={0.85}
              dragMomentum={false}
              // `rotate`/`y` come from dragX, which the variants never touch, so the enter/exit slide
              // (which animates `x`) and the tilt cannot fight over the same value.
              style={{ rotate: tilt, y: lift }}
              onPointerDownCapture={() => {
                draggedRef.current = false;
              }}
              onDrag={(_e, info) => {
                if (Math.abs(info.offset.x) > 6) draggedRef.current = true;
                dragX.set(info.offset.x);
              }}
              onDragEnd={onDragEnd}
              className="absolute inset-0 cursor-grab active:cursor-grabbing [transform-style:preserve-3d]"
            >
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
