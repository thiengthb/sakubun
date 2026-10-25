'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, RotateCcw, Shuffle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpeakButton } from '@/components/common/speak-button';
import { Sentence, spokenText, type CardTts } from '@/components/common/review-card';
import { useLocalState } from '@/components/common/use-session-state';
import {
  FRESH_DECK,
  resumeDeck,
  shuffleIds,
  type DeckProgress,
} from '@/lib/library/flashcard-deck';
import type { QuickCard } from '@/lib/app/quick-review';
import { speakable } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';
import { buildFuriganaMarkup, parseFurigana, type FuriganaSegment } from '@/lib/japanese/furigana';

// A group's items as flashcards, for browsing (thien, Nhóm round 1): the front is the word or the
// pattern alone, in the middle; a click turns the card over to its meaning and example. Small
// controls under the card step back and forth, turn it, shuffle the order, and start again, and
// the deck remembers its order and place on this device. Nothing is graded here, so the schedule
// only moves on /review.

// Above this many cards one step would be thinner than its gap, so the bar is a single fill.
const MAX_STEPS = 40;

function Expression({
  card,
  showFurigana,
  className,
}: {
  card: QuickCard;
  showFurigana: boolean;
  className?: string;
}) {
  const ruby = buildFuriganaMarkup(card.expression, card.reading);
  const segments: FuriganaSegment[] =
    showFurigana && ruby ? parseFurigana(ruby) : [{ text: card.expression }];
  return (
    <span lang="ja" className={cn('furigana break-words', className)}>
      {segments.map((s, i) =>
        s.reading ? (
          <ruby key={i}>
            {s.text}
            <rt className="visible">{s.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

function Progress({ index, total }: { index: number; total: number }) {
  const label = `Thẻ ${Math.min(index + 1, total)} / ${total}`;
  if (total > MAX_STEPS) {
    return (
      <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-label={label}>
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${(index / total) * 100}%` }}
        />
      </div>
    );
  }
  return (
    <div className="flex gap-1" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full bg-border',
            i < index && 'bg-muted-foreground',
            i === index && 'bg-foreground',
          )}
        />
      ))}
    </div>
  );
}

function Back({ card, showFurigana }: { card: QuickCard; showFurigana: boolean }) {
  const segments = card.sentence?.segments ?? null;
  return (
    <span className="flex w-full flex-col items-center gap-3 text-center">
      <span className="flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1">
        <Expression card={card} showFurigana={showFurigana} className="text-2xl font-bold" />
        {card.reading && (
          <span lang="ja" className="text-muted-foreground">
            [{card.reading}]
          </span>
        )}
      </span>
      {card.hanviet && (
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          [{card.hanviet}]
        </span>
      )}
      <span className="text-xl font-bold">{card.meaningVi}</span>
      {card.structure && (
        <span>
          <span className="font-semibold">Cấu trúc</span> <span lang="ja">{card.structure}</span>
        </span>
      )}
      {segments && (
        <span className="flex max-w-prose flex-col items-center gap-1 pt-2">
          <Sentence segments={segments} fill={null} showFurigana={showFurigana} />
          {card.sentence?.translation && (
            <span className="text-muted-foreground">{card.sentence.translation}</span>
          )}
        </span>
      )}
      {card.note && (
        <span className="max-w-prose rounded-xl bg-warn/10 px-3 py-2">
          <span className="font-semibold">Lưu ý</span> {card.note}
        </span>
      )}
    </span>
  );
}

export function GroupCards({
  groupId,
  cards,
  showFurigana: furiganaDefault,
  tts,
}: {
  groupId: string;
  cards: QuickCard[];
  showFurigana: boolean;
  tts: CardTts;
}) {
  const ids = useMemo(() => cards.map((c) => c.itemId), [cards]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.itemId, c])), [cards]);
  const [saved, setSaved] = useLocalState<DeckProgress>(`group.${groupId}.deck`, FRESH_DECK);
  const { order, index } = useMemo(() => resumeDeck(ids, saved), [ids, saved]);
  const [revealed, setRevealed] = useState(false);
  const [showFurigana, setShowFurigana] = useState(furiganaDefault);

  const total = order.length;
  const done = index >= total;
  const card = done ? undefined : byId.get(order[index]);
  const go = (to: number) => {
    setSaved((s) => ({ ...s, index: Math.max(0, Math.min(to, total)) }));
    setRevealed(false);
  };
  const shuffle = () => {
    setSaved((s) => ({ shuffled: s.shuffled ? null : shuffleIds(ids), index: 0 }));
    setRevealed(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      // A focused button already answers Enter and Space itself.
      const onButton = e.target instanceof HTMLElement && e.target.closest('button');
      if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'ArrowRight' && !done) go(index + 1);
      else if ((e.key === 'Enter' || e.key === ' ') && !done && !onButton) setRevealed((r) => !r);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-14 text-center ring-1 ring-foreground/10">
        <Sparkles className="size-6 text-primary" />
        <p className="font-medium">Chưa có thẻ nào để xem</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sang tab <b>Danh sách</b> và thêm mục vào nhóm, rồi quay lại đây.
        </p>
      </div>
    );
  }

  // Fills the screen under the list template's header (title, actions, tabs) so the controls sit
  // under the card without pushing the page into a scroll. On a laptop the deck keeps to a reading
  // width in the middle, like a card on a table, not a banner across the page.
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-16rem)] w-full max-w-3xl flex-col gap-4">
      <Progress index={index} total={total} />

      <div className="relative flex min-h-72 flex-1 perspective-distant">
        {done || !card ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border bg-card px-6 text-center">
            <p className="text-lg font-bold">Đã xem hết {total} thẻ</p>
            <p className="text-sm text-muted-foreground">
              Muốn được chấm và xếp lịch thì ôn ở trang Ôn nhanh.
            </p>
            <Button onClick={() => go(0)}>
              <RotateCcw aria-hidden />
              Xem lại từ đầu
            </Button>
          </div>
        ) : (
          <>
            <button
              key={card.itemId}
              type="button"
              aria-label={
                revealed
                  ? `Mặt sau: ${card.meaningVi}. Bấm để lật lại`
                  : `${card.expression}. Bấm để lật`
              }
              onClick={() => setRevealed((r) => !r)}
              className={cn(
                'relative flex-1 rounded-xl text-left transition-transform duration-(--p-motion-duration-slow) ease-standard transform-3d focus-visible:ring-[3px] focus-visible:ring-ring/50',
                revealed && 'rotate-y-180',
              )}
            >
              <span
                aria-hidden={revealed}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl border bg-card px-6 py-10 backface-hidden"
              >
                <span className="absolute top-4 left-4 text-xs font-medium text-muted-foreground">
                  {card.kind === 'VOCAB' ? 'Từ vựng' : 'Ngữ pháp'} · {card.level}
                </span>
                <Expression
                  card={card}
                  showFurigana={showFurigana}
                  className="max-w-full text-center text-4xl leading-relaxed font-bold md:text-5xl"
                />
                <span className="absolute bottom-4 text-xs text-muted-foreground">Bấm để lật</span>
              </span>
              <span
                aria-hidden={!revealed}
                className="absolute inset-0 flex flex-col items-center overflow-y-auto rounded-xl border bg-card px-6 py-10 backface-hidden rotate-y-180 [&>*]:my-auto"
              >
                {/* Only once turned: a back that is merely facing away still reads as on screen. */}
                {revealed && <Back card={card} showFurigana={showFurigana} />}
              </span>
            </button>
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
              <Button
                variant={showFurigana ? 'secondary' : 'ghost'}
                size="icon"
                aria-label="Bật tắt furigana"
                title="Furigana"
                aria-pressed={showFurigana}
                onClick={() => setShowFurigana((v) => !v)}
              >
                <span lang="ja">あ</span>
              </Button>
              <SpeakButton
                key={`speak-${card.itemId}`}
                text={
                  revealed && card.sentence
                    ? spokenText(card.sentence.segments, card.expression)
                    : speakable(card.expression)
                }
                label={revealed && card.sentence ? 'Nghe câu' : 'Nghe'}
                speaker={tts.voiceSpeaker}
                rate={tts.speechRate}
              />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <Button
            variant={saved.shuffled ? 'secondary' : 'ghost'}
            aria-label="Đảo thứ tự"
            aria-pressed={saved.shuffled != null}
            onClick={shuffle}
          >
            <Shuffle aria-hidden />
            {/* A phone has room for the short word only, beside the counter. */}
            Đảo<span className="max-md:hidden"> thứ tự</span>
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Thẻ trước"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="min-w-12 text-center text-sm font-semibold whitespace-nowrap tabular-nums">
            {Math.min(index + 1, total)} / {total}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Thẻ sau"
            disabled={done}
            onClick={() => go(index + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            aria-label="Lật thẻ"
            disabled={done}
            onClick={() => setRevealed((r) => !r)}
          >
            <RefreshCw aria-hidden />
            Lật<span className="max-md:hidden"> thẻ</span>
          </Button>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Chỉ để xem lại, không tính vào lịch ôn.
        <span className="max-md:hidden"> Phím mũi tên để chuyển thẻ, phím cách để lật.</span>
      </p>
    </div>
  );
}
