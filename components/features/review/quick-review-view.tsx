'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { IconAction } from '@/components/common/icon-action';
import { toast } from 'sonner';
import { Button, ButtonLink } from '@/components/ui/button';
import { useFillWindow } from '@/components/ui/use-fit-rows';
import { PageShell } from '@/components/layout/page-shell';
import { StudyFocus } from '@/components/layout/study-focus';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';
import {
  SessionFrame,
  SessionProgress,
  type Step,
} from '@/components/features/review/session-frame';
import { GradeBar, GRADES } from '@/components/features/review/grade-bar';
import { SessionSummary, type SessionResult } from '@/components/features/review/session-summary';
import { EmptyState } from '@/components/common/empty-state';
import { ReviewCard, type CardTts } from '@/components/common/review-card';
import type { CardAnswer, QuickCard, QuickReview } from '@/lib/app/quick-review';
import { isRemembered } from '@/lib/domain/quick-review';
import type { ActionResult } from '@/lib/core/action-result';
import { humanizeUntil } from '@/lib/core/format';
import type { RatingValue } from '@/lib/srs/srs';

type Answer = (answer: CardAnswer) => Promise<ActionResult<unknown>>;

type Result = SessionResult;

// A missed card comes back at the end of the session for practice, ungraded: its schedule already took
// the miss. A cloze shows its choices in another order, so the place of the answer is not what is
// remembered.
function retryCard(card: QuickCard): QuickCard {
  return card.mode === 'cloze' ? { ...card, choices: [...card.choices].reverse() } : card;
}

/** A flip card or a kanji card: answered by showing the back, then graded 1-4. */
const flips = (card: QuickCard | undefined) => card?.mode === 'flip' || card?.mode === 'kanji';

/** A kanji write card (KJ4): answered by writing it on the pad, which then shows the back. */
const writes = (card: QuickCard | undefined) =>
  card?.mode === 'kanji' && card.face.prompt === 'write';

const KIND_WORDS: [QuickCard['kind'], string][] = [
  ['GRAMMAR', 'ngữ pháp'],
  ['VOCAB', 'từ vựng'],
  ['KANJI', 'kanji'],
];

/** "Còn 4 thẻ: 1 ngữ pháp, 3 từ vựng", naming only the kinds left. */
function leftLine(left: QuickCard[]): string {
  if (left.length === 0) return 'Đã ôn hết thẻ đến hạn';
  const kinds = KIND_WORDS.map(([kind, word]) => ({
    word,
    n: left.filter((c) => c.kind === kind).length,
  })).filter((k) => k.n > 0);
  if (kinds.length === 1) return `Còn ${left.length} thẻ ${kinds[0].word}`;
  return `Còn ${left.length} thẻ: ${kinds.map((k) => `${k.n} ${k.word}`).join(', ')}`;
}

// Laptop: the keys for what can be done now, at the left end of the answer bar. A phone has no
// keyboard, and a narrow laptop page needs the bar's width for the buttons.
function KeyHints({
  card,
  intro,
  picked,
  revealed,
  practice,
  suggested,
}: {
  card: QuickCard;
  intro: boolean;
  picked: string | null;
  revealed: boolean;
  practice: boolean;
  /** The write pad's rating, which Enter then gives. */
  suggested: RatingValue | null;
}) {
  // Writing on the pad has no key.
  if (!intro && !revealed && writes(card)) return null;
  const keys: [string, string][] = intro
    ? [['Enter', 'đã xem']]
    : card.mode === 'cloze'
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
              ['Enter', GRADES.find((g) => g.rating === (suggested ?? 3))!.label],
            ]
          : [['Space', 'xem đáp án']];
  return (
    <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground max-lg:hidden">
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

export function QuickReviewView({
  initial,
  answer,
  showFurigana,
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
  // A write card's rating from the pad: the grade Enter gives and the one the bar puts first.
  const [suggested, setSuggested] = useState<RatingValue | null>(null);
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
  const [isPending, startTransition] = useTransition();
  // The answer bar rests on the window bottom while the card is short, and sticks there when long.
  const sessionRef = useRef<HTMLDivElement>(null);

  const practice = retry !== null;
  const deck = retry ? retry.cards : cards;
  const at = retry ? retry.index : index;
  const card = deck[at] as QuickCard | undefined;
  const done = at >= deck.length;
  // The root layout reads the due count for the phone's Ôn nhanh tab, and layouts do not re-render
  // on a client-side move, so the count is fetched again once the session ends. The session's own
  // state survives: it keeps the cards it opened with (above).
  const router = useRouter();
  const answered = results.length > 0;
  useEffect(() => {
    if (done && answered) router.refresh();
  }, [done, answered, router]);
  // The tab bar comes back with the summary; the session's height leaves room for it.
  useFillWindow(sessionRef, done);
  // A new item is met before it is tested: read, then "Đã xem" records Good, as it always has.
  const intro = !practice && flips(card) && !!card?.isNew;

  const send = (payload: CardAnswer, rating: RatingValue, advance: boolean) => {
    if (!card || isPending) return;
    const answered = card;
    const kind = card.kind;
    const met = intro;
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
      setResults((r) => [
        ...r,
        {
          itemId: answered.itemId,
          kind,
          expression: answered.expression,
          meaningVi: answered.meaningVi,
          rating,
          intro: met,
        },
      ]);
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
    setSuggested(null);
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
  const showReveal = flips(card) && !writes(card) && !revealed && !intro;
  const written = (rating: RatingValue) => {
    setSuggested(rating);
    setRevealed(true);
  };
  const good = suggested ?? 3;
  const showGrade = flips(card) && revealed && !practice && !intro;
  // A practice flip is not graded: once its answer is shown, the learner moves on.
  const showNext = graded || (flips(card) && revealed && practice);
  const practiceNext = () => {
    // A practice flip counts as right; a written one as the pad found it.
    const right = !writes(card) || (suggested ?? 1) > 1;
    if (retry && flips(card)) setRetry({ ...retry, right: [...retry.right, right] });
    next();
  };

  // A layout effect, so the handler that matches what is on screen is in place before the browser
  // paints it: with a passive effect a key pressed the moment the grade buttons appear still reached
  // the previous card's handler and was dropped.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (!card || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (card.mode === 'cloze' && !picked && /^[1-4]$/.test(e.key)) {
        const choice = card.choices[Number(e.key) - 1];
        if (choice) pick(choice.itemId);
      } else if (showGrade && /^[1-4]$/.test(e.key)) {
        grade(Number(e.key) as RatingValue);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (intro) grade(3);
        else if (showReveal) setRevealed(true);
        else if (showNext) practiceNext();
        else if (unsent) resend();
        // A focused grade button handles its own Enter; otherwise Enter means "Nhớ", or the pad's
        // rating on a write card.
        else if (showGrade && !(e.target instanceof HTMLButtonElement)) grade(good);
        else return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (cards.length === 0) {
    return (
      <PageShell template="form" title="Ôn nhanh" meta="Không có thẻ đến hạn">
        <EmptyState
          title={nextDueAt ? 'Hôm nay ôn xong rồi' : 'Kho chưa có mục nào'}
          description={
            nextDueAt
              ? `Thẻ tiếp theo đến hạn ${humanizeUntil(nextDueAt)}.`
              : 'Thêm mẫu ngữ pháp hoặc từ vựng vào kho để bắt đầu.'
          }
          action={
            nextDueAt ? undefined : (
              <ButtonLink href="/resources" variant="outline">
                Mở Tài nguyên
              </ButtonLink>
            )
          }
        />
      </PageShell>
    );
  }

  const answeredAt = retry ? retry.right.length : results.length;
  const steps = deck.map((_, i): Step => {
    if (i < answeredAt) {
      const right = retry ? retry.right[i] : isRemembered(results[i].rating);
      return right ? 'right' : 'wrong';
    }
    return i === at ? 'current' : 'todo';
  });

  return (
    <SessionFrame
      // The tab bar and the sidebar step aside during a session, so the way out is always on
      // screen (thien, U1 gate): a plain X, where learning apps put it.
      close={
        card && !done ? (
          <IconAction icon={X} label="Dừng ôn" onClick={() => router.push('/')} />
        ) : (
          <MobileTopBar />
        )
      }
      meta={
        <span className="tabular-nums">
          {/* Once over, nothing is left: after the retry round `index` still points at the last card. */}
          {done
            ? leftLine([])
            : retry
              ? `Làm lại ${retry.cards.length} câu sai`
              : leftLine(cards.slice(index))}
        </span>
      }
      progress={
        <SessionProgress
          steps={steps}
          label={`${retry ? 'Làm lại' : 'Thẻ'} ${Math.min(at + 1, deck.length)} / ${deck.length}`}
        />
      }
    >
      {/* A study session has the screen to itself until the summary. */}
      {card && !done && <StudyFocus />}
      <div ref={sessionRef} className="flex flex-col gap-6 md:gap-8">
        {/* Phone: the card fills the screen, so its answers and the bar below rest at the foot, in
            thumb reach. Laptop: the bar follows the card, and the key hints close the column. */}
        <div className="flex flex-col max-sm:flex-1">
          {done || !card ? (
            <SessionSummary results={results} nextDueAt={nextDueAt} />
          ) : (
            <ReviewCard
              key={`${practice ? 'retry' : 'main'}-${card.itemId}`}
              card={card}
              intro={intro}
              picked={picked}
              revealed={revealed}
              showFurigana={showFurigana}
              tts={tts}
              onPick={pick}
              suggested={suggested}
              onWritten={written}
            />
          )}
        </div>

        {/* Phone: the bar's buttons share the width; laptop: they keep their own size, at the right. */}
        <div className="flex gap-2 max-sm:sticky max-sm:bottom-0 max-sm:bg-background max-sm:pt-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))] max-sm:[&>*]:flex-1 sm:justify-end sm:[&>*]:min-w-32">
          {intro && (
            <Button
              size="lg"
              disabled={isPending}
              aria-keyshortcuts="Enter"
              onClick={() => grade(3)}
            >
              Đã xem
            </Button>
          )}
          {showReveal && (
            <Button size="lg" onClick={() => setRevealed(true)}>
              Xem đáp án
            </Button>
          )}
          {showGrade && card && (
            <GradeBar dueBy={card.dueBy} good={good} disabled={isPending} onGrade={grade} />
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
            <ButtonLink href="/" size="lg">
              Về trang chính
            </ButtonLink>
          )}
        </div>
        {card && !done && (
          <KeyHints
            card={card}
            intro={intro}
            picked={picked}
            revealed={revealed}
            practice={practice}
            suggested={suggested}
          />
        )}
      </div>
    </SessionFrame>
  );
}
