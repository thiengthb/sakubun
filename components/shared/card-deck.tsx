'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
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
import { Explain } from '@/components/shared/explain';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { useSessionState } from '@/components/shared/use-session-state';
import { cn } from '@/lib/utils';

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
    },
    [next, prev],
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
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );

  return (
    <div
      className={cn(
        'mx-auto flex min-h-[calc(100svh-6rem)] w-full max-w-4xl flex-col gap-3',
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
        <div className="relative min-h-[15rem] w-full flex-1 [perspective:1600px]">
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
