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
import { isRemembered } from '@/lib/domain/quick-review';
import type { ActionResult } from '@/lib/core/action-result';
import { humanizeUntil } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';
import type { RatingValue } from '@/lib/srs/srs';

type Answer = (answer: CardAnswer) => Promise<ActionResult<unknown>>;

interface Result {
  kind: QuickCard['kind'];
  rating: RatingValue;
}

// "10 phút", "8 ngày": the wait on a grade button, without "nữa" and never "dưới 1 phút".
const shortUntil = (due: Date) =>
  humanizeUntil(due).replace(/ nữa$/, '').replace('dưới 1 phút', '1 phút');

// The four FSRS buttons of a flip card (decision 0005), each with when the item comes back.
const GRADES: { rating: RatingValue; label: string; tone?: string }[] = [
  { rating: 1, label: 'Quên', tone: 'text-destructive' },
  { rating: 2, label: 'Khó' },
  { rating: 3, label: 'Nhớ' },
  { rating: 4, label: 'Dễ', tone: 'text-ok' },
];

// A missed card comes back at the end of the session for practice, ungraded: its schedule already took
// the miss. A cloze shows its choices in another order, so the place of the answer is not what is
// remembered.
function retryCard(card: QuickCard): QuickCard {
  return card.mode === 'cloze' ? { ...card, choices: [...card.choices].reverse() } : card;
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

// Laptop: the keys for what can be done now, at the left end of the answer bar. A phone has no
// keyboard, and a narrow laptop page needs the bar's width for the buttons.
function KeyHints({
  card,
  picked,
  revealed,
  practice,
}: {
  card: QuickCard;
  picked: string | null;
  revealed: boolean;
  practice: boolean;
}) {
  const keys: [string, string][] =
    card.mode === 'cloze'
      ? picked
        ? [['Enter', 'thẻ tiếp']]
        : [['1 2 3 4', 'chọn đáp án theo số trên thẻ']]
      : revealed && practice
        ? [['Enter', 'thẻ tiếp']]
        : revealed
          ? [
              ['1', 'Quên'],
              ['2', 'Khó'],
              ['3', 'Nhớ'],
              ['4', 'Dễ'],
              ['Enter', 'Nhớ'],
            ]
          : [['Space', 'xem đáp án']];
  return (
    <p className="mr-auto flex flex-wrap items-center gap-x-4 gap-y-2 self-center text-xs text-muted-foreground max-lg:hidden">
      <span>Phím tắt</span>
      {keys.map(([key, what]) => (
        <span key={key + what} className="flex items-center gap-1.5">
          <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5 font-sans font-semibold text-foreground">
            {key}
          </kbd>
          {what}
        </span>
      ))}
    </p>
  );
}

function Summary({ results, nextDueAt }: { results: Result[]; nextDueAt: Date | null }) {
  const remembered = (of: Result[]) => of.filter((r) => isRemembered(r.rating)).length;
  const byKind = (kind: QuickCard['kind'], label: string) => {
    const of = results.filter((r) => r.kind === kind);
    return of.length === 0 ? [] : [[label, `${remembered(of)}/${of.length} nhớ`]];
  };
  const count = (rating: RatingValue) => String(results.filter((r) => r.rating === rating).length);
  const tiles = [
    ...byKind('GRAMMAR', 'Ngữ pháp'),
    ...byKind('VOCAB', 'Từ vựng'),
    ['Khó', count(2)],
    ['Quên', count(1)],
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold">Xong buổi ôn</h2>
        <p className="text-muted-foreground tabular-nums">
          Nhớ {remembered(results)} trên {results.length} thẻ.
          {nextDueAt && ` Thẻ tiếp theo đến hạn ${humanizeUntil(nextDueAt)}.`}
        </p>
      </div>
      <dl className="flex flex-wrap gap-3">
        {tiles.map(([label, value]) => (
          <Card key={label} size="sm" className="min-w-32 flex-1 gap-1 px-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-lg font-bold tabular-nums">{value}</dd>
          </Card>
        ))}
      </dl>
      <div className="space-y-1 rounded-lg bg-muted p-4">
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
  // The end-of-session round over the cards missed above; null until it starts.
  const [retry, setRetry] = useState<{
    cards: QuickCard[];
    index: number;
    right: boolean[];
  } | null>(null);
  const missed = useRef<QuickCard[]>([]);
  const [showFurigana, setShowFurigana] = useState(furiganaDefault);
  const [isPending, startTransition] = useTransition();
  // The answer bar rests on the window bottom while the card is short, and sticks there when long.
  const sessionRef = useRef<HTMLDivElement>(null);
  useFillWindow(sessionRef);

  const practice = retry !== null;
  const deck = retry ? retry.cards : cards;
  const at = retry ? retry.index : index;
  const card = deck[at] as QuickCard | undefined;
  const done = at >= deck.length;

  const send = (payload: CardAnswer, rating: RatingValue, advance: boolean) => {
    if (!card || isPending) return;
    const answered = card;
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
      setResults((r) => [...r, { kind, rating }]);
      if (rating === 1) missed.current.push(retryCard(answered));
      if (advance) next();
    });
  };

  const next = () => {
    if (retry) {
      setRetry({ ...retry, index: retry.index + 1 });
    } else if (index + 1 >= cards.length && missed.current.length > 0) {
      setRetry({ cards: missed.current, index: 0, right: [] });
    } else {
      setIndex((i) => i + 1);
    }
    setPicked(null);
    setRevealed(false);
    setUnsent(null);
  };

  // A cloze is graded the moment a choice is picked; the card stays until "Tiếp".
  const pick = (choiceId: string) => {
    if (!card || card.mode !== 'cloze' || picked) return;
    setPicked(choiceId);
    if (retry) {
      setRetry({ ...retry, right: [...retry.right, choiceId === card.itemId] });
      return;
    }
    send({ itemId: card.itemId, mode: 'cloze', choiceId }, choiceId === card.itemId ? 3 : 1, false);
  };
  const resend = () => {
    if (!card || unsent?.mode !== 'cloze') return;
    send(unsent, unsent.choiceId === card.itemId ? 3 : 1, false);
  };
  const grade = (rating: RatingValue) => {
    if (!card) return;
    send({ itemId: card.itemId, mode: 'flip', rating }, rating, true);
  };

  const graded = card?.mode === 'cloze' && picked !== null && (practice || results.length > index);
  const showReveal = card?.mode === 'flip' && !revealed;
  const showGrade = card?.mode === 'flip' && revealed && !practice;
  // A practice flip is not graded: once its answer is shown, the learner moves on.
  const showNext = graded || (card?.mode === 'flip' && revealed && practice);
  const practiceNext = () => {
    if (retry && card?.mode === 'flip') setRetry({ ...retry, right: [...retry.right, true] });
    next();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (!card || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (card.mode === 'cloze' && !picked && /^[1-4]$/.test(e.key)) {
        const choice = card.choices[Number(e.key) - 1];
        if (choice) pick(choice.itemId);
      } else if (showGrade && /^[1-4]$/.test(e.key)) {
        grade(Number(e.key) as RatingValue);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (showReveal) setRevealed(true);
        else if (showNext) practiceNext();
        else if (unsent) resend();
        // A focused grade button handles its own Enter; otherwise Enter means "Nhớ".
        else if (showGrade && !(e.target instanceof HTMLButtonElement)) grade(3);
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
      <PageShell template="form" title="Ôn nhanh" meta="Không có thẻ đến hạn" pageIcons={furigana}>
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
      meta={
        <span className="tabular-nums">
          {retry && !done ? `Làm lại ${retry.cards.length} câu sai` : leftLine(cards.slice(index))}
        </span>
      }
      pageIcons={furigana}
    >
      <div ref={sessionRef} className="flex flex-col gap-6 md:gap-8">
        <div
          className="flex gap-1.5"
          role="img"
          aria-label={`${retry ? 'Làm lại' : 'Thẻ'} ${Math.min(at + 1, deck.length)} / ${deck.length}`}
        >
          {deck.map((c, i) => {
            const right = retry ? retry.right[i] : results[i] && isRemembered(results[i].rating);
            const answeredAt = retry ? retry.right.length : results.length;
            return (
              <div
                key={c.itemId}
                className={cn(
                  'h-2 flex-1 rounded-full bg-muted',
                  i < answeredAt && (right ? 'bg-ok' : 'bg-destructive'),
                  i === at && i >= answeredAt && 'bg-accent-brand',
                )}
              />
            );
          })}
        </div>

        <div className="flex-1">
          {done || !card ? (
            <Summary results={results} nextDueAt={nextDueAt} />
          ) : (
            <ReviewCard
              key={`${practice ? 'retry' : 'main'}-${card.itemId}`}
              card={card}
              picked={picked}
              revealed={revealed}
              showFurigana={showFurigana}
              tts={tts}
              onPick={pick}
            />
          )}
        </div>

        {/* Phone: the bar's buttons share the width; laptop: they keep their own size, at the right. */}
        <div className="sticky bottom-0 flex gap-2 bg-background pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] max-sm:[&>*]:flex-1 sm:justify-end sm:[&>*]:min-w-32">
          {card && !done && (
            <KeyHints card={card} picked={picked} revealed={revealed} practice={practice} />
          )}
          {showReveal && (
            <Button size="lg" onClick={() => setRevealed(true)}>
              Xem đáp án
            </Button>
          )}
          {showGrade && card && (
            // Phone: two columns, the misses (Quên, Khó) on the left and the hits (Nhớ, Dễ) on the
            // right, so a thumb finds each side without reading.
            <div
              className="grid grid-flow-col grid-cols-2 grid-rows-2 gap-2 sm:flex"
              role="group"
              aria-label="Chấm thẻ"
            >
              {GRADES.map(({ rating, label, tone }) => (
                <Button
                  key={rating}
                  size="lg"
                  variant={rating === 3 ? 'default' : 'outline'}
                  className={cn('sm:min-w-32', tone)}
                  disabled={isPending}
                  aria-keyshortcuts={rating === 3 ? '3 Enter' : String(rating)}
                  onClick={() => grade(rating)}
                >
                  {label}
                  <span className="text-xs opacity-75">{shortUntil(card.dueBy[rating])}</span>
                </Button>
              ))}
            </div>
          )}
          {card?.mode === 'cloze' && picked && unsent && (
            <Button size="lg" disabled={isPending} onClick={resend}>
              Gửi lại
            </Button>
          )}
          {((card?.mode === 'cloze' && picked && !unsent) || (showNext && practice)) && (
            <Button size="lg" disabled={!showNext} onClick={practiceNext}>
              Tiếp
            </Button>
          )}
          {done && (
            <Button size="lg" asChild>
              <Link href="/">Về trang chính</Link>
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
