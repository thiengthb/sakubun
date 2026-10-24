'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReviewCard, type CardTts } from '@/components/common/review-card';
import type { QuickCard } from '@/lib/app/quick-review';
import { cn } from '@/lib/core/utils';

// A group's items on the quick-review card, for browsing: flip to see the answer, step back and
// forth. Nothing is graded here, so the schedule only moves on /review.
export function GroupCards({
  cards,
  showFurigana: furiganaDefault,
  tts,
}: {
  cards: QuickCard[];
  showFurigana: boolean;
  tts: CardTts;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showFurigana, setShowFurigana] = useState(furiganaDefault);

  const card = cards[index] as QuickCard | undefined;
  const done = index >= cards.length;
  const go = (to: number) => {
    setIndex(Math.max(0, Math.min(to, cards.length)));
    setRevealed(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button')) {
        return;
      }
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'ArrowRight' && !done) go(index + 1);
      else if ((e.key === 'Enter' || e.key === ' ') && !done) {
        if (revealed) go(index + 1);
        else setRevealed(true);
      } else return;
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
        <p className="max-w-sm text-subhead text-muted-foreground">
          Sang tab <b>Danh sách</b> và thêm mục vào nhóm, rồi quay lại đây.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-subhead text-muted-foreground">
          Chỉ để xem lại, không tính vào lịch ôn.
        </p>
        <Button
          variant={showFurigana ? 'secondary' : 'ghost'}
          size="icon"
          aria-label="Bật tắt furigana"
          aria-pressed={showFurigana}
          onClick={() => setShowFurigana((v) => !v)}
        >
          <span lang="ja">あ</span>
        </Button>
      </div>
      <div
        className="flex gap-1"
        aria-label={`Thẻ ${Math.min(index + 1, cards.length)} / ${cards.length}`}
      >
        {cards.map((c, i) => (
          <div
            key={c.itemId}
            className={cn(
              'h-1.5 flex-1 rounded-full bg-border',
              i < index && 'bg-muted-foreground',
              i === index && 'bg-foreground',
            )}
          />
        ))}
      </div>

      <div className="flex-1">
        {done || !card ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="font-semibold">Đã xem hết {cards.length} thẻ</p>
            <p className="text-subhead text-muted-foreground">
              Muốn được chấm và xếp lịch thì ôn ở trang Ôn nhanh.
            </p>
          </div>
        ) : (
          <ReviewCard
            key={card.itemId}
            card={card}
            picked={null}
            revealed={revealed}
            showFurigana={showFurigana}
            tts={tts}
            onPick={() => {}}
          />
        )}
      </div>

      <div className="sticky bottom-0 flex gap-2.5 bg-background pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          variant="outline"
          className="h-14 text-base"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          Trước
        </Button>
        {done ? (
          <Button key="restart" size="lg" className="h-14 flex-1 text-base" onClick={() => go(0)}>
            Xem lại từ đầu
          </Button>
        ) : revealed ? (
          <Button
            key="next"
            size="lg"
            className="h-14 flex-1 text-base"
            onClick={() => go(index + 1)}
          >
            Tiếp
          </Button>
        ) : (
          <Button
            key="reveal"
            size="lg"
            className="h-14 flex-1 bg-foreground text-base text-background hover:bg-foreground/85"
            onClick={() => setRevealed(true)}
          >
            Xem đáp án
          </Button>
        )}
      </div>
    </div>
  );
}
