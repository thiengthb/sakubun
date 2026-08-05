'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { motion } from 'motion/react';
import { Check, Info, Settings2, Volume2, Shuffle, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/shared/explain';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { SpokenLine } from '@/components/shared/spoken-line';
import { ItemDetailDialog } from '@/components/resources/item-detail-dialog';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { useSessionState } from '@/components/shared/use-session-state';
import { speakable } from '@/lib/format';
import { parseEnrichment } from '@/lib/enrichment';
import { cn } from '@/lib/utils';
import type { GroupMemberItem } from '@/lib/groups';

/** TTS + furigana settings threaded from the page so every Japanese line plays and reads in sync. */
interface TtsProps {
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}

const detailKind = (kind: string): 'grammar' | 'vocab' => (kind === 'VOCAB' ? 'vocab' : 'grammar');

/**
 * Quizlet-style flashcard study for a group's items — pure client-side, NEVER touches FSRS (a group
 * is an organisation layer only; the SRS write path stays `submit_review`). Members already arrive on
 * the page, so this renders existing data with no extra query. "Đã thuộc" progress persists in
 * localStorage per group; direction, shuffle and round state are session-only.
 */

/** Which language is on the front face. */
type Direction = 'ja-vi' | 'vi-ja';

/** Fisher–Yates on a copy — deterministic-free; used for the Shuffle button and each replay round. */
function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const knownStorageKey = (groupId: string) => `sakubun.flashcard-known.${groupId}`;

// useSyncExternalStore plumbing for the persisted "đã thuộc" set: a stable server snapshot (empty) so
// SSR + hydration match, and a CACHED client reader so getSnapshot returns the SAME Set instance while
// the stored string is unchanged (a fresh Set every call would loop the store forever).
const emptySubscribe = () => () => {};
const EMPTY_KNOWN = new Set<string>();
let knownCache: { key: string; raw: string | null; set: Set<string> } | null = null;

function readKnownSet(groupId: string): Set<string> {
  const key = knownStorageKey(groupId);
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null; // localStorage unavailable (private mode) → treat as no saved progress.
  }
  if (knownCache && knownCache.key === key && knownCache.raw === raw) return knownCache.set;
  let set: Set<string>;
  try {
    set = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    set = new Set();
  }
  knownCache = { key, raw, set };
  return set;
}

function writeKnownSet(groupId: string, next: Set<string>) {
  try {
    localStorage.setItem(knownStorageKey(groupId), JSON.stringify([...next]));
  } catch {
    // Best-effort; a failed write only loses cross-reload persistence, not the session.
  }
}

/** The Japanese term, big, with reference audio + furigana (SpokenLine). The prompt side for ja→vi. */
function TermFace({
  item,
  tts,
  playToken,
}: {
  item: GroupMemberItem;
  tts: TtsProps;
  playToken?: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <SpokenLine
        text={item.expression}
        speakText={speakable(item.expression)}
        ruby={buildFuriganaMarkup(item.expression, item.reading)}
        showFurigana={tts.showFurigana}
        speaker={tts.voiceSpeaker}
        rate={tts.speechRate}
        label="Nghe"
        // The card now owns the viewport, so the term scales with it instead of sitting at one size in
        // the middle of a lot of nothing.
        className="text-4xl leading-tight font-semibold sm:text-5xl"
        playToken={playToken}
      />
    </div>
  );
}

/** The meaning-only prompt side for vi→ja (nghĩa first, term hidden until flip). */
function MeaningPromptFace({ item }: { item: GroupMemberItem }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 text-center">
      <span className="text-3xl leading-snug font-semibold sm:text-4xl">
        {item.meaningVi || <span className="text-muted-foreground">(chưa có nghĩa)</span>}
      </span>
      {item.hanviet && (
        <span className="text-sm text-muted-foreground">Hán Việt: {item.hanviet}</span>
      )}
    </div>
  );
}

/** The answer side: term + nghĩa + cách dùng + ví dụ (audio + furigana). Scrolls if long. */
function DetailFace({
  item,
  tts,
  playToken,
}: {
  item: GroupMemberItem;
  tts: TtsProps;
  /** Auto-read latch for the TERM only (the first Japanese of the answer) — never for the examples. */
  playToken?: string | null;
}) {
  const enrichment = detailKind(item.kind) === 'grammar' ? parseEnrichment(item.enrichment) : null;
  const examples = enrichment ? [enrichment.example, ...enrichment.examples] : [];
  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-y-auto px-1 py-1 text-left">
      <div>
        <SpokenLine
          text={item.expression}
          speakText={speakable(item.expression)}
          ruby={buildFuriganaMarkup(item.expression, item.reading)}
          showFurigana={tts.showFurigana}
          speaker={tts.voiceSpeaker}
          rate={tts.speechRate}
          label="Nghe"
          className="text-2xl font-semibold sm:text-3xl"
          playToken={playToken}
        />
      </div>

      <div className="space-y-0.5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Nghĩa</p>
        <p className="font-medium">
          {item.meaningVi || <span className="text-muted-foreground">(chưa có nghĩa)</span>}
          {item.hanviet && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">· {item.hanviet}</span>
          )}
        </p>
      </div>

      {enrichment?.usage && (
        <div className="space-y-0.5">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Cách dùng</p>
          <p className="text-sm">{enrichment.usage}</p>
        </div>
      )}

      {examples.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Ví dụ</p>
          <ul className="space-y-2">
            {examples.map((ex, i) => (
              <li key={`${ex.ja}-${i}`} className="space-y-0.5">
                <SpokenLine
                  text={ex.ja}
                  ruby={ex.jaRuby}
                  showFurigana={tts.showFurigana}
                  speaker={tts.voiceSpeaker}
                  rate={tts.speechRate}
                  label="Nghe ví dụ"
                />
                <p className="text-sm text-muted-foreground">{ex.vi}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Vocab has no enrichment card — its stored example lives in notes (plain text, plays, no ruby). */}
      {!enrichment && item.notes && (
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Ví dụ</p>
          <SpokenLine
            text={item.notes}
            showFurigana={tts.showFurigana}
            speaker={tts.voiceSpeaker}
            rate={tts.speechRate}
            label="Nghe ví dụ"
          />
        </div>
      )}
    </div>
  );
}

/** Keyboard shortcuts, documented in one place — surfaced via the info tooltip beside the enrich button
 * and mirrored by the global keydown handler below. */
const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space / Enter', action: 'Lật thẻ' },
  { keys: '→', action: 'Đã thuộc' },
  { keys: '←', action: 'Đang học' },
  { keys: 'Backspace', action: 'Thẻ trước' },
];

/** An info icon whose hover tooltip lists every keyboard shortcut. Sits to the RIGHT of the enrich
 * button on each card, so the shortcut guide is always one hover away without cluttering the card. */
function ShortcutsInfo() {
  return (
    <Explain
      side="bottom"
      align="end"
      className="w-52 flex-col items-stretch gap-1 py-2"
      text={
        <>
          <p className="mb-0.5 font-medium">Phím tắt</p>
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
        aria-label="Phím tắt"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
    </Explain>
  );
}

/** One flip card. Front (prompt) chosen by `direction`; back is always the full DetailFace. An enrich
 * button overlays the top-right corner (outside the flip, so it never rotates) → the full detail dialog. */
function FlashCard({
  item,
  direction,
  flipped,
  onFlip,
  tts,
  autoSpeak = false,
}: {
  item: GroupMemberItem;
  direction: Direction;
  flipped: boolean;
  onFlip: () => void;
  tts: TtsProps;
  /** Read the Japanese out loud by itself — see the settings popover. */
  autoSpeak?: boolean;
}) {
  // WHICH Japanese gets read, per direction (the rule the user asked for):
  //   ja→vi — the PROMPT is the Japanese term, so read it as the card appears.
  //   vi→ja — the prompt is Vietnamese and reading it would give the answer away; read the first
  //           Japanese of the ANSWER instead, i.e. the term, once the card is flipped.
  // Examples are never auto-read in either direction: they are a paragraph, and a card that starts
  // reciting three sentences the moment you flip it is noise you have to interrupt.
  // The token carries the card id + face, so flipping back and forth does NOT replay (see SpeakButton).
  const frontToken = autoSpeak && direction === 'ja-vi' && !flipped ? `${item.itemId}:term` : null;
  const answerToken =
    autoSpeak && direction === 'vi-ja' && flipped ? `${item.itemId}:answer` : null;

  const front =
    direction === 'ja-vi' ? (
      <TermFace item={item} tts={tts} playToken={frontToken} />
    ) : (
      <MeaningPromptFace item={item} />
    );
  const frontHint = direction === 'ja-vi' ? 'Tiếng Nhật' : 'Tiếng Việt';

  const faceCls = 'absolute inset-0 rounded-2xl bg-card p-5 ring-1 ring-foreground/10';
  const centered = 'flex flex-col items-center justify-center gap-2';

  return (
    <div className="relative min-h-[15rem] w-full flex-1 [perspective:1600px]">
      {/* A div, NOT a <button>: the faces contain SpeakButtons (real <button>s), and a button cannot
          nest a button (hydration error). Keyboard flip is handled by the component's global keydown
          listener (Space/Enter), so this only needs click + focus affordance. Clicks that land on an
          inner control (speak) don't flip. */}
      <motion.div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, a')) return;
          onFlip();
        }}
        aria-label={flipped ? 'Lật lại mặt trước' : 'Lật xem mặt sau'}
        // `absolute inset-0`, NOT `h-full`: this sits inside a flex item that got its height from
        // flex-grow, and a percentage height against that resolves to the CONTENT height — measured at
        // 245px inside a 465px slot. Absolute positioning against the `relative` wrapper fills it exactly.
        className="absolute inset-0 block cursor-pointer rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={cn(faceCls, centered, '[backface-visibility:hidden]')}>
          <span className="absolute top-3 left-4 text-xs tracking-wide text-muted-foreground uppercase">
            {frontHint}
          </span>
          {front}
        </div>
        <div className={cn(faceCls, '[transform:rotateY(180deg)] [backface-visibility:hidden]')}>
          <span className="mb-1 block text-xs tracking-wide text-muted-foreground uppercase">
            Đáp án
          </span>
          <DetailFace item={item} tts={tts} playToken={answerToken} />
        </div>
      </motion.div>

      {/* Enrich / xem kĩ hơn + the shortcuts info — sit above the flip, never rotate. The info icon is
          to the RIGHT of the enrich button; both open/hover without flipping the card. */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <ItemDetailDialog
          item={{
            expression: item.expression,
            reading: item.reading,
            hanviet: item.hanviet,
            meaningVi: item.meaningVi ?? '',
            notes: item.notes ?? null,
            level: item.level,
            enrichment: item.enrichment,
            suspended: item.suspended ?? false,
            srs: item.srs ?? null,
          }}
          kind={detailKind(item.kind)}
          triggerVariant="icon"
          detailHref={`/resources/${item.itemId}`}
          voiceSpeaker={tts.voiceSpeaker}
          speechRate={tts.speechRate}
          showFurigana={tts.showFurigana}
        />
        <ShortcutsInfo />
      </div>
    </div>
  );
}

export function GroupFlashcards({
  groupId,
  members,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  groupId: string;
  members: GroupMemberItem[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const tts: TtsProps = { voiceSpeaker, speechRate, showFurigana };
  const [direction, setDirection] = useState<Direction>('ja-vi');
  // Shuffle is a persistent toggle (not a one-shot): ON keeps every round in random order, OFF keeps
  // the members' own order. Toggling reorders the current round immediately.
  const [shuffle, setShuffle] = useState(false);
  // Ids to study this round, in order. Reset when the member set changes (add/remove on the list tab).
  const [round, setRound] = useState<string[]>(() => members.map((m) => m.itemId));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownThisRound, setKnownThisRound] = useState<Set<string>>(new Set());
  const [stillThisRound, setStillThisRound] = useState<Set<string>>(new Set());
  // Undo stack: previous (idx, mark) so "quay lại" can rewind the last decision.
  const historyRef = useRef<{ id: string; mark: 'known' | 'still' }[]>([]);

  // Auto-read the Japanese aloud. Session-scoped (survives leaving the tab and coming back, unlike
  // `direction`/`shuffle`) because it is a preference about your ears, not about this round.
  const [autoSpeak, setAutoSpeak] = useSessionState('flashcards.autoSpeak', false);

  const membersOrder = useMemo(() => members.map((m) => m.itemId), [members]);
  /** Order a set of ids for a round: random when shuffle is on, else the members' own order. */
  const orderFor = useCallback(
    (ids: string[]) => {
      if (shuffle) return shuffled(ids);
      const set = new Set(ids);
      return membersOrder.filter((id) => set.has(id));
    },
    [shuffle, membersOrder],
  );

  // Cumulative mastery, persisted per group in localStorage. Read via useSyncExternalStore (stable
  // server snapshot = empty, so SSR + hydration match); `bumpKnown()` forces a re-read after a write.
  const [, bumpKnown] = useReducer((n: number) => n + 1, 0);
  const known = useSyncExternalStore(
    emptySubscribe,
    () => readKnownSet(groupId),
    () => EMPTY_KNOWN,
  );
  const persistKnown = useCallback(
    (next: Set<string>) => {
      writeKnownSet(groupId, next);
      bumpKnown();
    },
    [groupId],
  );

  const byId = useMemo(() => new Map(members.map((m) => [m.itemId, m])), [members]);

  // When the member set changes (item added/removed on the list tab), the parent re-keys this
  // component so it remounts with a fresh deck — no in-effect reset needed here.

  const total = round.length;
  const done = idx >= total;
  const current = done ? undefined : byId.get(round[idx]);

  const mark = useCallback(
    (mark: 'known' | 'still') => {
      if (done) return;
      const id = round[idx];
      historyRef.current.push({ id, mark });
      if (mark === 'known') {
        setKnownThisRound((s) => new Set(s).add(id));
        setStillThisRound((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        if (!known.has(id)) persistKnown(new Set(known).add(id));
      } else {
        setStillThisRound((s) => new Set(s).add(id));
        setKnownThisRound((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        if (known.has(id)) {
          const n = new Set(known);
          n.delete(id);
          persistKnown(n);
        }
      }
      setFlipped(false);
      setIdx((i) => i + 1);
    },
    [done, idx, round, known, persistKnown],
  );

  const undo = useCallback(() => {
    const last = historyRef.current.pop();
    if (!last) return;
    setKnownThisRound((s) => {
      const n = new Set(s);
      n.delete(last.id);
      return n;
    });
    setStillThisRound((s) => {
      const n = new Set(s);
      n.delete(last.id);
      return n;
    });
    setFlipped(false);
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  const startRound = useCallback(
    (ids: string[]) => {
      setRound(orderFor(ids));
      setIdx(0);
      setFlipped(false);
      setKnownThisRound(new Set());
      setStillThisRound(new Set());
      historyRef.current = [];
    },
    [orderFor],
  );

  const resetProgress = useCallback(() => {
    persistKnown(new Set());
    startRound(membersOrder);
  }, [membersOrder, persistKnown, startRound]);

  /** Flip the shuffle toggle and re-order the CURRENT round to match (resets round marks + position). */
  const toggleShuffle = useCallback(() => {
    const next = !shuffle;
    setShuffle(next);
    const set = new Set(round);
    setRound(next ? shuffled(round) : membersOrder.filter((id) => set.has(id)));
    setIdx(0);
    setFlipped(false);
    setKnownThisRound(new Set());
    setStillThisRound(new Set());
    historyRef.current = [];
  }, [shuffle, round, membersOrder]);

  const setDir = useCallback((d: Direction) => {
    setDirection(d);
    setFlipped(false);
  }, []);

  // Keyboard: Space/Enter flip · ArrowRight = đã thuộc · ArrowLeft = đang học · Backspace = undo.
  // Ignore when a control has focus so a focused button's own key handling isn't doubled.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      // A modal (the enrich detail dialog) is open → let it own the keyboard, don't grade behind it.
      if (document.querySelector('[role="dialog"]')) return;
      const onButton = tag === 'button';
      if (done) return;
      if ((e.key === ' ' || e.key === 'Enter') && !onButton) {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        mark('known');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        mark('still');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, mark, undo]);

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-14 text-center ring-1 ring-foreground/10">
        <Sparkles className="size-6 text-primary" />
        <p className="font-medium">Chưa có thẻ nào để học</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sang tab <b>Danh sách</b> và thêm mục vào nhóm, rồi quay lại đây để học flashcard.
        </p>
      </div>
    );
  }

  // Progress reflects position in the current round (cards seen / total), NOT cumulative mastery.
  const pct = total ? Math.round((Math.min(idx, total) / total) * 100) : 0;
  const dirLabel = direction === 'ja-vi' ? 'Nhật → Việt' : 'Việt → Nhật';

  const inner = (
    // FILLS the tab: full width (was `max-w-xl`, i.e. a 576px column in the middle of a 1280px page) and
    // a height derived from the viewport, so the card gets everything left over after the top bar, the
    // progress bar and the grading buttons. 15rem is the measured height of that chrome plus PageShell's
    // own pt-6/pb-6 — `svh` (not `vh`) so a phone's collapsing address bar does not clip the buttons.
    // This replaces the old "Mở rộng" overlay: the card is now that big WITHOUT a second mode to enter,
    // which also means the enrich dialog and the settings popover never have to out-stack an overlay.
    <div className="flex min-h-[calc(100svh-6rem)] w-full flex-col gap-3">
      {/* Top bar: position + settings popover (direction + shuffle) + expand toggle. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {done ? (
            <span>Xong vòng này</span>
          ) : (
            <span>
              Thẻ <b className="text-foreground">{idx + 1}</b> / {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <ExpandingIconButton icon={Settings2} label="Cài đặt" variant="outline" size="sm" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Chiều thẻ · đang: <span className="text-foreground">{dirLabel}</span>
                </p>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setDir('ja-vi')}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                      direction === 'ja-vi'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Nhật → Việt
                  </button>
                  <button
                    type="button"
                    onClick={() => setDir('vi-ja')}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                      direction === 'vi-ja'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Việt → Nhật
                  </button>
                </div>
              </div>
              <label className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <Shuffle className="size-4 text-muted-foreground" />
                  Trộn thẻ
                </span>
                <Switch checked={shuffle} onCheckedChange={toggleShuffle} disabled={total < 2} />
              </label>
              <label className="flex items-start justify-between gap-3">
                <span className="flex items-start gap-2 text-sm">
                  <Volume2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="flex flex-col leading-tight">
                    Tự đọc tiếng Nhật
                    {/* State the RULE here, because it differs by direction and a bare toggle would
                        leave the user guessing why nothing spoke on a Việt → Nhật prompt. */}
                    <span className="text-xs font-normal text-muted-foreground">
                      {direction === 'ja-vi'
                        ? 'Đọc mẫu/từ ngay khi thẻ hiện ra.'
                        : 'Đọc phần tiếng Nhật đầu của đáp án sau khi lật. Ví dụ thì không tự đọc.'}
                    </span>
                  </span>
                </span>
                <Switch
                  checked={autoSpeak}
                  onCheckedChange={(v) => setAutoSpeak(v === true)}
                  className="mt-0.5"
                />
              </label>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Round progress bar (by card position) — h-3 to match the JLPT level bars + settings sliders. */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {done ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
          <Check className="size-8 text-primary" />
          <div className="space-y-1">
            <p className="text-lg font-semibold">Hoàn thành vòng học</p>
            <p className="text-sm text-muted-foreground">
              Đã thuộc {knownThisRound.size} · Đang học {stillThisRound.size}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {stillThisRound.size > 0 && (
              <Button onClick={() => startRound([...stillThisRound])}>
                Ôn tiếp {stillThisRound.size} thẻ đang học
              </Button>
            )}
            <Button variant="outline" onClick={() => startRound(membersOrder)}>
              Học lại tất cả
            </Button>
            <Button variant="ghost" onClick={resetProgress}>
              Đặt lại tiến độ
            </Button>
          </div>
        </div>
      ) : (
        current && (
          <>
            <FlashCard
              item={current}
              direction={direction}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
              tts={tts}
              autoSpeak={autoSpeak}
            />

            <p className="text-center text-xs text-muted-foreground">
              Bấm vào thẻ (hoặc phím cách) để lật · ← đang học · → đã thuộc
            </p>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-12 flex-1 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400"
                onClick={() => mark('still')}
              >
                Đang học ({stillThisRound.size})
              </Button>
              <Button
                variant="outline"
                className="h-12 flex-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
                onClick={() => mark('known')}
              >
                <Check className="size-4" />
                Đã thuộc ({knownThisRound.size})
              </Button>
            </div>

            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={idx === 0}
                className="text-muted-foreground"
              >
                <Undo2 className="size-4" />
                Quay lại thẻ trước
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );

  return inner;
}
