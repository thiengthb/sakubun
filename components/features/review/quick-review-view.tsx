'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useFillWindow } from '@/components/ui/use-fit-rows';
import { PageShell } from '@/components/layout/page-shell';
import { EmptyState } from '@/components/common/empty-state';
import { ReviewCard, type CardTts } from '@/components/common/review-card';
import type { CardAnswer, QuickCard, QuickReview } from '@/lib/app/quick-review';
import type { ActionResult } from '@/lib/core/action-result';
import { humanizeUntil } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';

type Answer = (answer: CardAnswer) => Promise<ActionResult<unknown>>;

interface Result {
  kind: QuickCard['kind'];
  correct: boolean;
}

/** "Còn 4 thẻ: 1 ngữ pháp, 3 từ vựng", naming only the kinds left. */
function leftLine(left: QuickCard[]): string {
  const grammar = left.filter((c) => c.kind === 'GRAMMAR').length;
  const vocab = left.length - grammar;
  if (left.length === 0) return 'Đã ôn hết thẻ đến hạn';
  if (grammar === 0) return `Còn ${vocab} thẻ từ vựng`;
  if (vocab === 0) return `Còn ${grammar} thẻ ngữ pháp`;
  return `Còn ${left.length} thẻ: ${grammar} ngữ pháp, ${vocab} từ vựng`;
}

function Summary({ results, nextDueAt }: { results: Result[]; nextDueAt: Date | null }) {
  const count = (kind: QuickCard['kind']) => {
    const of = results.filter((r) => r.kind === kind);
    return of.length === 0 ? null : `${of.filter((r) => r.correct).length}/${of.length} nhớ`;
  };
  const again = results.filter((r) => !r.correct).length;
  const rows = [
    ['Ngữ pháp', count('GRAMMAR')],
    ['Từ vựng', count('VOCAB')],
    ['Gặp lại hôm nay', String(again)],
  ].filter((row): row is [string, string] => row[1] !== null);
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-accent-brand">Xong buổi ôn</p>
        <p className="text-lg font-bold tabular-nums">
          {results.length - again} trên {results.length} thẻ nhớ
        </p>
        {nextDueAt && (
          <p className="text-muted-foreground">Thẻ tiếp theo đến hạn {humanizeUntil(nextDueAt)}.</p>
        )}
      </div>
      <Card className="py-0">
        <dl className="divide-y px-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between py-3">
              <dt>{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="rounded-lg bg-muted p-4">
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
  // A cloze pick the server never recorded. The answer is already on screen, so the same pick is
  // sent again rather than reopening the choices (a second pick would grade with the answer known).
  const [unsent, setUnsent] = useState<CardAnswer | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [showFurigana, setShowFurigana] = useState(furiganaDefault);
  const [isPending, startTransition] = useTransition();
  // The answer bar rests on the window bottom while the card is short, and sticks there when long.
  const sessionRef = useRef<HTMLDivElement>(null);
  useFillWindow(sessionRef);

  const card = cards[index] as QuickCard | undefined;
  const done = index >= cards.length;

  const send = (payload: CardAnswer, correct: boolean, advance: boolean) => {
    if (!card || isPending) return;
    const kind = card.kind;
    startTransition(async () => {
      const result = await answer(payload).catch((): ActionResult<unknown> => ({
        ok: false,
        error: 'Mất kết nối, chưa lưu được.',
      }));
      if (!result.ok) {
        toast.error(result.error);
        if (payload.mode === 'cloze') setUnsent(payload);
        return;
      }
      setUnsent(null);
      setResults((r) => [...r, { kind, correct }]);
      if (advance) next();
    });
  };

  const next = () => {
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealed(false);
    setUnsent(null);
  };

  // A cloze is graded the moment a choice is picked; the card stays until "Tiếp".
  const pick = (choiceId: string) => {
    if (!card || card.mode !== 'cloze' || picked) return;
    setPicked(choiceId);
    send({ itemId: card.itemId, mode: 'cloze', choiceId }, choiceId === card.itemId, false);
  };
  const resend = () => {
    if (!card || unsent?.mode !== 'cloze') return;
    send(unsent, unsent.choiceId === card.itemId, false);
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
      if (!card || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (card.mode === 'cloze' && !picked && /^[1-4]$/.test(e.key)) {
        const choice = card.choices[Number(e.key) - 1];
        if (choice) pick(choice.itemId);
      } else if (showGrade && (e.key === '1' || e.key === '2')) {
        grade(e.key === '2');
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (showReveal) setRevealed(true);
        else if (graded) next();
        else if (unsent) resend();
        // A focused grade button handles its own Enter; otherwise Enter means "Nhớ".
        else if (showGrade && !(e.target instanceof HTMLButtonElement)) grade(true);
        else return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const furigana = (
    <Button
      variant={showFurigana ? 'secondary' : 'ghost'}
      size="icon"
      aria-label="Bật tắt furigana"
      aria-pressed={showFurigana}
      onClick={() => setShowFurigana((v) => !v)}
    >
      <span lang="ja">あ</span>
    </Button>
  );

  if (cards.length === 0) {
    return (
      <PageShell
        template="form"
        title="Ôn nhanh"
        meta="Không có thẻ đến hạn"
        pageIcons={furigana}
      >
        <EmptyState
          title={nextDueAt ? 'Hôm nay ôn xong rồi' : 'Kho chưa có mục nào'}
          description={
            nextDueAt
              ? `Thẻ tiếp theo đến hạn ${humanizeUntil(nextDueAt)}.`
              : 'Thêm mẫu ngữ pháp hoặc từ vựng vào kho để bắt đầu.'
          }
          action={
            nextDueAt ? undefined : (
              <Button variant="outline" asChild>
                <Link href="/resources">Mở Tài nguyên</Link>
              </Button>
            )
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      template="form"
      title="Ôn nhanh"
      meta={<span className="tabular-nums">{leftLine(cards.slice(index))}</span>}
      pageIcons={furigana}
    >
      <div ref={sessionRef} className="flex max-w-3xl flex-col gap-6">
        <div
          className="flex gap-1.5"
          role="img"
          aria-label={`Thẻ ${Math.min(index + 1, cards.length)} / ${cards.length}`}
        >
          {cards.map((c, i) => (
            <div
              key={c.itemId}
              className={cn(
                'h-2 flex-1 rounded-full bg-muted',
                i < results.length && (results[i].correct ? 'bg-ok' : 'bg-destructive'),
                i === index && i >= results.length && 'bg-accent-brand',
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

        <div className="sticky bottom-0 flex gap-2 bg-background pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] max-sm:[&>*]:flex-1 sm:justify-end">
          {showReveal && (
            <Button size="lg" className="flex-1" onClick={() => setRevealed(true)}>
              Xem đáp án
            </Button>
          )}
          {showGrade && card && (
            <>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 text-destructive"
                disabled={isPending}
                aria-keyshortcuts="1"
                onClick={() => grade(false)}
              >
                Chưa nhớ
                <span className="text-xs opacity-75">hôm nay</span>
              </Button>
              <Button
                size="lg"
                className="flex-1"
                disabled={isPending}
                aria-keyshortcuts="2 Enter"
                onClick={() => grade(true)}
              >
                Nhớ
                <span className="text-xs opacity-75">{humanizeUntil(card.dueIfRight)}</span>
              </Button>
            </>
          )}
          {card?.mode === 'cloze' && picked && unsent && (
            <Button size="lg" className="flex-1" disabled={isPending} onClick={resend}>
              Gửi lại
            </Button>
          )}
          {card?.mode === 'cloze' && picked && !unsent && (
            <Button size="lg" className="flex-1" disabled={!graded} onClick={next}>
              Tiếp
            </Button>
          )}
          {done && (
            <Button size="lg" className="flex-1" asChild>
              <Link href="/">Về trang chính</Link>
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
