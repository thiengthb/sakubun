'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Shuffle, Volume2, SearchX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CardDeck,
  DeckSettings,
  DeckShortcutsInfo,
  DeckSwitchRow,
  shuffled,
  useCardDeck,
} from '@/components/shared/card-deck';
import { EmptyState } from '@/components/shared/empty-state';
import { SpokenLine } from '@/components/shared/spoken-line';
import { StarButton } from '@/components/shared/star-button';
import { turnLabels } from '@/lib/turn-labels';
import { useSessionState } from '@/components/shared/use-session-state';
import {
  EXERCISE_TYPE_LABELS,
  RatingChip,
  dirLabel,
  scoreClass,
} from '@/components/history/history-cards';
import { formatDateTimeVN } from '@/lib/format';
import { scoreLabel } from '@/lib/score-label';
import { stripEmoji } from '@/lib/text';
import type { SentenceHistoryRow } from '@/lib/practice';

/**
 * /history in flashcard form — the same deck as a group's flashcards, dealt from the learner's OWN
 * past attempts instead of from a list of patterns.
 *
 * The card is the drill the sentence originally was: front is the đề, back is the reference answer
 * plus what you actually wrote and what Claude said about it. So this is not a second history view —
 * it is the practice loop replayed, one swipe at a time, over exactly the rows the filters have already
 * narrowed to (fail-only, starred, N2, last week). Từ 2026-08-11, ô tìm và bộ lọc KHÔNG còn ở chế độ
 * này — chúng thuộc chế độ danh sách, và lựa chọn ở đó vẫn quyết định chồng thẻ này gồm những gì.
 *
 * PENDING rows are excluded: they have no answer yet, so their card would have a blank back. Nothing
 * here writes — no FSRS, no re-grade. Only the star toggles, and it was already a pure UI flag.
 */

/** Cards are the rows that HAVE an answer side. */
const studiable = (s: SentenceHistoryRow) => s.status !== 'PENDING';

/** The đề, big. Japanese gets the karaoke play line + furigana; a Vietnamese đề is plain text. */
function PromptFace({
  sentence,
  showFurigana,
  speaker,
  rate,
  playToken,
}: {
  sentence: SentenceHistoryRow;
  showFurigana: boolean;
  speaker?: number;
  rate?: number;
  playToken?: string | null;
}) {
  return (
    <>
      <div className="absolute top-3 left-4 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{dirLabel(sentence.direction)}</Badge>
        {EXERCISE_TYPE_LABELS[sentence.exerciseType] && (
          <Badge variant="outline">{EXERCISE_TYPE_LABELS[sentence.exerciseType]}</Badge>
        )}
      </div>
      <div className="flex w-full flex-col items-center gap-2 px-1 pt-8 text-center">
        {sentence.direction === 'JA_VI' ? (
          <SpokenLine
            text={sentence.sourceText}
            ruby={sentence.sourceRuby}
            showFurigana={showFurigana}
            speaker={speaker}
            rate={rate}
            label="Nghe đề"
            align="start"
            className="text-2xl leading-snug font-semibold sm:text-3xl"
            playToken={playToken}
          />
        ) : (
          <p lang="vi" className="text-2xl leading-snug font-semibold sm:text-3xl">
            {sentence.sourceText}
          </p>
        )}
      </div>
    </>
  );
}

/** The answer side: tham khảo · bạn dịch · nhận xét · các mẫu đã chấm. The face itself scrolls. */
function AnswerFace({
  sentence,
  showFurigana,
  speaker,
  rate,
  playToken,
}: {
  sentence: SentenceHistoryRow;
  showFurigana: boolean;
  speaker?: number;
  rate?: number;
  /** Auto-read latch for the REFERENCE answer (vi→ja only — see the rule in the parent). */
  playToken?: string | null;
}) {
  const grammar = sentence.ratings.filter((r) => r.role !== 'VOCAB');
  const vocab = sentence.ratings.filter((r) => r.role === 'VOCAB');
  const score = scoreLabel(sentence.status, sentence.score);
  // A JP → VN attempt's answer side is Vietnamese, so only the VN → JP direction has Japanese to play
  // or annotate here. (The JP text of a JP → VN row is the đề, and that plays on the front face.)
  const jaAnswer = sentence.direction === 'VI_JA';

  return (
    <div className="flex w-full flex-col gap-3 text-left text-sm">
      {/* pr-16 keeps the timestamp clear of the star + info controls pinned to the card's top-right
          corner — they float above the face, so the face has to leave room for them. */}
      <div className="flex flex-wrap items-center gap-2 pr-16 text-xs text-muted-foreground">
        {/* Cùng một nguồn nhãn với thẻ ở /history và trang chủ (`lib/score-label.ts`): mặt sau này là
            chỗ THỨ BA từng để trống khi lượt không có điểm. */}
        {score && (
          <span className={score.muted ? 'font-medium' : scoreClass(sentence.score as number)}>
            {score.text}
          </span>
        )}
        <span className="ml-auto">{formatDateTimeVN(sentence.createdAt)}</span>
      </div>

      {sentence.suggested && (
        <div className="space-y-0.5">
          {/* Same shared table as the history cards and the chat block: on a quiz this line is the
              ANSWER KEY, in conversation it is a model utterance — neither is a "reference translation". */}
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {turnLabels(sentence.exerciseType, {
              prompt: 'Đề',
              answer: 'Bạn dịch',
              reference: 'Tham khảo',
              retry: '',
            }).reference}
          </p>
          {jaAnswer ? (
            <SpokenLine
              text={sentence.suggested}
              ruby={sentence.suggestedRuby}
              showFurigana={showFurigana}
              speaker={speaker}
              rate={rate}
              label="Nghe đáp án"
              align="start"
              className="text-lg leading-snug font-semibold"
              playToken={playToken}
            />
          ) : (
            <p className="font-medium">{sentence.suggested}</p>
          )}
        </div>
      )}

      <div className="space-y-0.5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Bạn đã dịch</p>
        {jaAnswer ? (
          <SpokenLine
            text={sentence.userAnswer}
            showFurigana={showFurigana}
            speaker={speaker}
            rate={rate}
            label="Nghe câu bạn viết"
            align="start"
          />
        ) : (
          <p>{sentence.userAnswer}</p>
        )}
      </div>

      {sentence.feedback && (
        <div className="space-y-0.5">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Nhận xét</p>
          <p className="text-muted-foreground">{stripEmoji(sentence.feedback)}</p>
        </div>
      )}

      {(grammar.length > 0 || vocab.length > 0) && (
        <div className="space-y-2 border-t border-border/70 pt-2">
          {grammar.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Ngữ pháp:</span>
              {grammar.map((r, i) => (
                <RatingChip key={`g-${i}`} expression={r.expression} rating={r.rating} />
              ))}
            </div>
          )}
          {vocab.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Từ vựng:</span>
              {vocab.map((r, i) => (
                <RatingChip key={`v-${i}`} expression={r.expression} rating={r.rating} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryFlashcards({
  sentences,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
  toolbarStart,
}: {
  /** Already filtered by the toolbar above — the deck studies exactly what the list would show. */
  sentences: SentenceHistoryRow[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
  /**
   * Nút lật về danh sách, do `HistoryList` truyền xuống để nó đứng NGAY TRƯỚC nút cài đặt deck. Trước
   * 2026-08-11 hai nút này ở hai hàng khác nhau vì hàng tìm kiếm chen vào giữa.
   */
  toolbarStart?: ReactNode;
}) {
  const pool = useMemo(() => sentences.filter(studiable), [sentences]);
  const [shuffle, setShuffle] = useState(false);
  // Shuffle keeps an explicit id order rather than re-randomising on every render: the filters above can
  // narrow WHILE the deck is open, and a fresh shuffle per render would jump the learner to a different
  // card each time the list re-polled (LiveRefresh runs on this page).
  const [order, setOrder] = useState<string[] | null>(null);
  const [autoSpeak, setAutoSpeak] = useSessionState('flashcards.autoSpeak', false);

  const cards = useMemo(() => {
    if (!order) return pool;
    const rank = new Map(order.map((id, i) => [id, i]));
    // Rows that appeared after the shuffle (a widened filter, a freshly graded sentence) sort to the
    // end rather than being dropped — the deck must never silently hide a row the list would show.
    return [...pool].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [pool, order]);

  const deck = useCardDeck(cards.length);
  const current = cards[deck.index];

  const toggleShuffle = useCallback(
    (on: boolean) => {
      setShuffle(on);
      setOrder(on ? shuffled(pool.map((s) => s.id)) : null);
      deck.restart();
    },
    [pool, deck],
  );

  const replay = useCallback(
    (reshuffle: boolean) => {
      if (reshuffle) {
        setShuffle(true);
        setOrder(shuffled(pool.map((s) => s.id)));
      }
      deck.restart();
    },
    [pool, deck],
  );

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="Chưa có lượt nào để lướt"
        description="Chỉ những lượt đã chấm (hoặc đã bỏ qua) mới thành thẻ được — lượt đang chờ trả lời thì chưa có mặt sau."
        className="py-12"
      />
    );
  }

  // Same rule as the group deck, read off the sentence instead of a direction toggle:
  //   JP → VN — the đề IS the Japanese, so it reads as the card appears.
  //   VN → JP — the đề is Vietnamese; reading it would give nothing away but there is no Japanese to
  //             read yet, so the reference answer reads once the card is flipped.
  const promptToken =
    autoSpeak && current && current.direction === 'JA_VI' && !deck.flipped
      ? `${current.id}:source`
      : null;
  const answerToken =
    autoSpeak && current && current.direction === 'VI_JA' && deck.flipped
      ? `${current.id}:ref`
      : null;

  return (
    <CardDeck
      deck={deck}
      cardKey={current?.id ?? 'done'}
      unit="Lượt"
      // Shorter than the deck's own default: /history sits under a breadcrumb row that a group's
      // flashcard tab does not have. At the default the nav arrows sat ~15px below the fold at 1280x720
      // (measured 2026-08-06) and the page grew a scrollbar to reach them. (Cho tới 2026-08-11 phần
      // chiếm chỗ là cả hàng tìm kiếm + bộ lọc; giờ hàng đó không còn nên chỗ này còn dư ra một chút.)
      className="min-h-[calc(100svh-10rem)]"
      // Hàng tìm kiếm không còn ở chế độ này, nên thanh tiến độ lên chiếm đúng hàng đó.
      inlineProgress
      toolbar={
        <>
          {toolbarStart}
          <DeckSettings>
            <DeckSwitchRow
              icon={Shuffle}
              label="Trộn thẻ"
              checked={shuffle}
              onCheckedChange={toggleShuffle}
              disabled={cards.length < 2}
            />
            <DeckSwitchRow
              icon={Volume2}
              label="Tự đọc tiếng Nhật"
              hint="Đề tiếng Nhật đọc ngay khi thẻ hiện ra; đề tiếng Việt thì đọc bản tham khảo sau khi lật."
              checked={autoSpeak}
              onCheckedChange={setAutoSpeak}
            />
          </DeckSettings>
        </>
      }
      front={
        current && (
          <PromptFace
            sentence={current}
            showFurigana={showFurigana}
            speaker={voiceSpeaker}
            rate={speechRate}
            playToken={promptToken}
          />
        )
      }
      back={
        current && (
          <AnswerFace
            sentence={current}
            showFurigana={showFurigana}
            speaker={voiceSpeaker}
            rate={speechRate}
            playToken={answerToken}
          />
        )
      }
      corner={
        current && (
          <>
            <StarButton id={current.id} starred={current.starred} kind="sentence" />
            <DeckShortcutsInfo />
          </>
        )
      }
      done={
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
          <div className="space-y-1">
            <p className="text-lg font-semibold">Đã lướt hết {cards.length} lượt</p>
            <p className="text-sm text-muted-foreground">
              Đổi bộ lọc ở trên để lấy một chồng thẻ khác, hoặc học lại từ đầu.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => replay(false)}>Học lại từ đầu</Button>
            {cards.length > 1 && (
              <Button variant="outline" onClick={() => replay(true)}>
                Trộn rồi học lại
              </Button>
            )}
          </div>
        </div>
      }
    />
  );
}
