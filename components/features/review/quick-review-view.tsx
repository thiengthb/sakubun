'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { ReviewCard, type CardTts } from '@/components/features/review/review-card';
import type { CardAnswer, QuickCard, QuickReview } from '@/lib/app/quick-review';
import type { ActionResult } from '@/lib/core/action-result';
import { humanizeUntil } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';

type Answer = (answer: CardAnswer) => Promise<ActionResult<unknown>>;

interface Result {
  kind: QuickCard['kind'];
  correct: boolean;
}

function Pill({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium">
      {label} <b className="font-bold tabular-nums">{count}</b>
    </span>
  );
}

function Summary({ results, nextDueAt }: { results: Result[]; nextDueAt: Date | null }) {
  const count = (kind: QuickCard['kind']) => {
    const of = results.filter((r) => r.kind === kind);
    return `${of.filter((r) => r.correct).length}/${of.length} nhớ`;
  };
  const again = results.filter((r) => !r.correct).length;
  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold text-accent-brand">Xong buổi ôn</p>
      <p className="text-lg font-bold">
        {results.length - again} trên {results.length} thẻ nhớ
      </p>
      <dl className="divide-y rounded-2xl border bg-card px-4">
        {[
          ['Ngữ pháp', count('GRAMMAR')],
          ['Từ vựng', count('VOCAB')],
          ['Gặp lại hôm nay', String(again)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between py-3">
            <dt>{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {nextDueAt && (
        <p className="text-muted-foreground">Thẻ tiếp theo đến hạn {humanizeUntil(nextDueAt)}.</p>
      )}
      <div className="rounded-2xl bg-muted p-4">
        <p className="font-semibold">Còn sức? Dịch một câu với Claude</p>
        <p className="text-muted-foreground">
          Mở Claude, gõ “học”. Claude lấy đúng một mẫu đến hạn để bạn dịch.
        </p>
      </div>
    </div>
  );
}

export function QuickReviewView({
  initial,
  answer,
  showFurigana: furiganaDefault,
  tts,
}: {
  initial: QuickReview;
  answer: Answer;
  showFurigana: boolean;
  tts: CardTts;
}) {
  // The session keeps the cards it opened with, so a refresh of the page data mid-session cannot
  // shift the cards under the learner.
  const [{ cards, nextDueAt }] = useState(initial);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [showFurigana, setShowFurigana] = useState(furiganaDefault);
  const [isPending, startTransition] = useTransition();

  const card = cards[index] as QuickCard | undefined;
  const done = index >= cards.length;

  const send = (payload: CardAnswer, correct: boolean, advance: boolean) => {
    if (!card || isPending) return;
    const kind = card.kind;
    startTransition(async () => {
      const result = await answer(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setResults((r) => [...r, { kind, correct }]);
      if (advance) next();
    });
  };

  const next = () => {
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealed(false);
  };

  // A cloze is graded the moment a choice is picked; the card stays until "Tiếp".
  const pick = (choiceId: string) => {
    if (!card || card.mode !== 'cloze' || picked) return;
    setPicked(choiceId);
    send({ itemId: card.itemId, mode: 'cloze', choiceId }, choiceId === card.itemId, false);
  };
  const grade = (remembered: boolean) => {
    if (!card) return;
    send({ itemId: card.itemId, mode: 'flip', remembered }, remembered, true);
  };

  const graded = card?.mode === 'cloze' && picked !== null && results.length > index;
  const showReveal = card?.mode === 'flip' && !revealed;
  const showGrade = card?.mode === 'flip' && revealed;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (!card || e.metaKey || e.ctrlKey || e.altKey) return;
      if (card.mode === 'cloze' && !picked && /^[1-4]$/.test(e.key)) {
        const choice = card.choices[Number(e.key) - 1];
        if (choice) pick(choice.itemId);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (showReveal) setRevealed(true);
        else if (graded) next();
        else return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (cards.length === 0) {
    return (
      <EmptyState
        title="Không còn thẻ nào đến hạn"
        description={
          nextDueAt
            ? `Thẻ tiếp theo đến hạn ${humanizeUntil(nextDueAt)}.`
            : 'Thêm mẫu ngữ pháp hoặc từ vựng vào kho để bắt đầu.'
        }
      />
    );
  }

  const left = cards.slice(index);
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1.5">
          <Pill label="Ngữ pháp" count={left.filter((c) => c.kind === 'GRAMMAR').length} />
          <Pill label="Từ vựng" count={left.filter((c) => c.kind === 'VOCAB').length} />
        </div>
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
              i < results.length && (results[i].correct ? 'bg-ok' : 'bg-destructive'),
              i === index && i >= results.length && 'bg-foreground',
            )}
          />
        ))}
      </div>

      <div className="flex-1">
        {done || !card ? (
          <Summary results={results} nextDueAt={nextDueAt} />
        ) : (
          <ReviewCard
            key={card.itemId}
            card={card}
            picked={picked}
            revealed={revealed}
            showFurigana={showFurigana}
            tts={tts}
            onPick={pick}
          />
        )}
      </div>

      <div className="sticky bottom-0 flex gap-2.5 bg-background pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {showReveal && (
          <Button size="lg" className="h-14 flex-1 text-base" onClick={() => setRevealed(true)}>
            Xem đáp án
          </Button>
        )}
        {showGrade && card && (
          <>
            <Button
              size="lg"
              variant="outline"
              className="h-14 flex-1 flex-col gap-0 text-base text-destructive"
              disabled={isPending}
              onClick={() => grade(false)}
            >
              Chưa nhớ
              <small className="text-xs font-normal opacity-75">gặp lại hôm nay</small>
            </Button>
            <Button
              size="lg"
              className="h-14 flex-1 flex-col gap-0 text-base"
              disabled={isPending}
              onClick={() => grade(true)}
            >
              Nhớ
              <small className="text-xs font-normal opacity-75">
                {humanizeUntil(card.dueIfRight)}
              </small>
            </Button>
          </>
        )}
        {card?.mode === 'cloze' && picked && (
          <Button size="lg" className="h-14 flex-1 text-base" disabled={!graded} onClick={next}>
            Tiếp
          </Button>
        )}
        {done && (
          <Button size="lg" className="h-14 flex-1 text-base" asChild>
            <Link href="/">Về trang chính</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
