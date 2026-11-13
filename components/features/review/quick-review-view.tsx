'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2, X } from 'lucide-react';
import { IconAction } from '@/components/common/icon-action';
import { toast } from 'sonner';
import { Button, ButtonLink } from '@/components/ui/button';
import { useFillWindow } from '@/components/ui/use-fit-rows';
import { PageShell } from '@/components/layout/page-shell';
import {
  SessionFrame,
  SessionPanel,
  SessionProgress,
  type Step,
} from '@/components/features/review/session-frame';
import { GradeBar, GRADES } from '@/components/features/review/grade-bar';
import { SessionSummary, type SessionResult } from '@/components/features/review/session-summary';
import { useGradeQueue } from '@/components/features/review/use-grade-queue';
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

// Laptop: the keys for what can be done now, in the side panel, one to a line. A phone has no
// keyboard, and neither has the panel's room.
function KeyHints({
  card,
  intro,
  picked,
  revealed,
  practice,
  suggested,
  canUndo,
}: {
  card: QuickCard;
  intro: boolean;
  picked: string | null;
  revealed: boolean;
  practice: boolean;
  /** The write pad's rating, which Enter then gives. */
  suggested: RatingValue | null;
  /** The last grade can still be taken back (U2f). */
  canUndo: boolean;
}) {
  // Writing on the pad has no key of its own; the last grade can still be taken back.
  const writing = !intro && !revealed && writes(card);
  const undo: [string, string][] = canUndo ? [['Z', 'hoàn tác lần chấm vừa rồi']] : [];
  if (writing && !canUndo) return null;
  const own: [string, string][] = writing
    ? []
    : intro
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
  const keys = [...own, ...undo];
  return (
    <div className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
      <p>Phím tắt</p>
      {keys.map(([key, what]) => (
        <span key={key + what} className="flex items-center gap-1.5">
          <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5 font-sans font-semibold text-foreground">
            {key}
          </kbd>
          {what}
        </span>
      ))}
    </div>
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
  const [results, setResults] = useState<Result[]>([]);
  // The end-of-session round over the cards missed above; null until it starts.
  const [retry, setRetry] = useState<{
    cards: QuickCard[];
    index: number;
    right: boolean[];
  } | null>(null);
  const missed = useRef<QuickCard[]>([]);
  // U2e: a grade moves the session on at once and reaches the server behind it.
  const grades = useGradeQueue<CardAnswer>(answer, (error) => toast.error(error));
  // U2f: the session as it was before the last grade, while that grade is held for undo.
  const beforeGrade = useRef<{
    index: number;
    retry: typeof retry;
    results: Result[];
    missed: QuickCard[];
    suggested: RatingValue | null;
  } | null>(null);
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
  const saved = grades.saved;
  const { release } = grades;
  // Over: nothing is left to take back, so the held grade goes and the summary can count on it.
  useEffect(() => {
    if (done) release();
  }, [done, release]);
  useEffect(() => {
    if (done && answered && saved) router.refresh();
  }, [done, answered, saved, router]);
  // The tab bar comes back with the summary; the session's height leaves room for it.
  useFillWindow(sessionRef, done);
  // A new item is met before it is tested: read, then "Đã xem" records Good, as it always has.
  const intro = !practice && flips(card) && !!card?.isNew;

  const send = (payload: CardAnswer, rating: RatingValue, advance: boolean) => {
    if (!card) return;
    // A grade that moves on (a flip, an intro) is held so it can be taken back; a cloze pick is
    // not: its answer is on screen, and picking again would grade with the answer known.
    if (advance) {
      beforeGrade.current = {
        index,
        retry,
        results,
        missed: [...missed.current],
        suggested,
      };
    } else beforeGrade.current = null;
    grades.enqueue(payload, { hold: advance });
    setResults((r) => [
      ...r,
      {
        itemId: card.itemId,
        kind: card.kind,
        expression: card.expression,
        meaningVi: card.meaningVi,
        rating,
        intro,
      },
    ]);
    if (rating === 1) missed.current.push(retryCard(card));
    if (advance) next();
  };

  const next = () => {
    if (retry) {
      // Functional: practiceNext() may have just added this card's result to the same state.
      setRetry((r) => (r ? { ...r, index: r.index + 1 } : r));
    } else if (index + 1 >= cards.length && missed.current.length > 0) {
      setRetry({ cards: missed.current, index: 0, right: [] });
    } else {
      setIndex((i) => i + 1);
    }
    setPicked(null);
    setRevealed(false);
    setSuggested(null);
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
  const grade = (rating: RatingValue) => {
    if (!card) return;
    send({ itemId: card.itemId, mode: 'flip', rating }, rating, true);
  };
  // U2f (thien, 14/11): one step back, to the card just graded, its answer open to grade again.
  // The grade never reached the server, so there is nothing to take out of the review log.
  const canUndo = grades.canUndo && !done;
  const undo = () => {
    const before = beforeGrade.current;
    if (!before || done || !grades.undo()) return;
    beforeGrade.current = null;
    missed.current = before.missed;
    setIndex(before.index);
    setRetry(before.retry);
    setResults(before.results);
    setPicked(null);
    setRevealed(true);
    setSuggested(before.suggested);
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
    if (retry && flips(card)) setRetry((r) => (r ? { ...r, right: [...r.right, right] } : r));
    next();
  };

  // A layout effect, so the handler that matches what is on screen is in place before the browser
  // paints it: with a passive effect a key pressed the moment the grade buttons appear still reached
  // the previous card's handler and was dropped.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A focused link (the sidebar, the tab bar) keeps its own keys: Enter there leaves the session
      // rather than answering the card. So does a button outside the session, like the X (Dừng ôn):
      // Enter on it stops the session instead of grading the card on screen.
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, a[href]'))
        return;
      if (e.target instanceof HTMLButtonElement && !sessionRef.current?.contains(e.target)) return;
      if (!card || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'z' || e.key === 'Z') {
        if (!canUndo) return;
        undo();
      } else if (card.mode === 'cloze' && !picked && /^[1-4]$/.test(e.key)) {
        const choice = card.choices[Number(e.key) - 1];
        if (choice) pick(choice.itemId);
      } else if (showGrade && /^[1-4]$/.test(e.key)) {
        grade(Number(e.key) as RatingValue);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (intro) grade(3);
        else if (showReveal) setRevealed(true);
        else if (showNext) practiceNext();
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

  // Once over, the bar shows the graded round again, not the retry round: a card missed stays red
  // on the summary even if it was right the second time.
  const shownRetry = done ? null : retry;
  const answeredAt = shownRetry ? shownRetry.right.length : results.length;
  // An intro card was read, not tested: the panel's counts leave it out, like the summary.
  const tested = results.filter((r) => !r.intro);
  const steps = (done ? cards : deck).map((_, i): Step => {
    if (i < answeredAt) {
      const right = shownRetry ? shownRetry.right[i] : isRemembered(results[i].rating);
      return right ? 'right' : 'wrong';
    }
    return i === at ? 'current' : 'todo';
  });

  return (
    <SessionFrame
      // The way out of a session (thien, U1 gate): a plain X at the end of the title's row.
      actions={
        card && !done ? (
          <>
            {canUndo && <IconAction icon={Undo2} label="Hoàn tác" onClick={undo} />}
            <IconAction icon={X} label="Dừng ôn" onClick={() => router.push('/')} />
          </>
        ) : undefined
      }
      meta={
        <span className="tabular-nums">
          {/* Once over, nothing is left: after the retry round `index` still points at the last card. */}
          {done
            ? leftLine([])
            : retry
              ? `Làm lại ${retry.cards.length} câu sai`
              : leftLine(cards.slice(index))}
          {/* U2e: grades the network dropped wait on the device and go again on their own. */}
          <span role="status" className="text-warn">
            {grades.unsaved > 0 && ` · Chưa lưu ${grades.unsaved} thẻ, đang thử lại`}
          </span>
        </span>
      }
      progress={
        <SessionProgress
          steps={steps}
          label={
            done
              ? `Thẻ ${cards.length} / ${cards.length}`
              : `${retry ? 'Làm lại' : 'Thẻ'} ${Math.min(at + 1, deck.length)} / ${deck.length}`
          }
        />
      }
    >
      {/* Layout C (thien, 2026-11-13): the card and its bar on the left; from 1280px a small panel
          on the right with the counts and the keys. Narrower, beside the sidebar, the four grade
          buttons need the whole width, so the session keeps one column and no panel. From 1280px the
          bar follows the card instead of resting at the window bottom (thien, 2026-11-14: a bar far
          below a short card looked detached); a card taller than the window still keeps it sticky. */}
      <div
        ref={sessionRef}
        className="flex flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-8"
      >
        <div className="flex flex-1 flex-col gap-6 md:gap-8">
          <div className="flex flex-1 flex-col xl:flex-none">
            {done || !card ? (
              <SessionSummary results={results} nextDueAt={nextDueAt} saved={saved} />
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
          <div
            data-session-bar
            className="sticky bottom-(--bottom-nav-space) flex gap-2 bg-background pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] max-md:pb-2 max-sm:[&>*]:flex-1 sm:justify-end sm:[&>*]:min-w-32"
          >
            {intro && (
              <Button size="lg" aria-keyshortcuts="Enter" onClick={() => grade(3)}>
                Đã xem
              </Button>
            )}
            {showReveal && (
              <Button size="lg" onClick={() => setRevealed(true)}>
                Xem đáp án
              </Button>
            )}
            {showGrade && card && <GradeBar dueBy={card.dueBy} good={good} onGrade={grade} />}
            {((card?.mode === 'cloze' && picked) || (showNext && practice)) && (
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
        </div>
        <SessionPanel
          remembered={tested.filter((r) => isRemembered(r.rating)).length}
          missed={tested.filter((r) => !isRemembered(r.rating)).length}
          left={done ? 0 : deck.length - answeredAt}
        >
          {card && !done && (
            <KeyHints
              card={card}
              intro={intro}
              picked={picked}
              revealed={revealed}
              practice={practice}
              suggested={suggested}
              canUndo={canUndo}
            />
          )}
        </SessionPanel>
      </div>
    </SessionFrame>
  );
}
