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
  RatingChip,
  dirLabel,
  exerciseTypeLabel,
  scoreClass,
} from '@/components/history/history-cards';
import { formatDateTimeVN } from '@/lib/format';
import { scoreLabel } from '@/lib/score-label';
import { stripEmoji } from '@/lib/text';
import type { SentenceHistoryRow } from '@/lib/practice';

const studiable = (s: SentenceHistoryRow) => s.status !== 'PENDING';

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
        {exerciseTypeLabel(sentence.exerciseType) && (
          <Badge variant="outline">{exerciseTypeLabel(sentence.exerciseType)}</Badge>
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
  playToken?: string | null;
}) {
  const grammar = sentence.ratings.filter((r) => r.role !== 'VOCAB');
  const vocab = sentence.ratings.filter((r) => r.role === 'VOCAB');
  const score = scoreLabel(sentence.status, sentence.score);
  const jaAnswer = sentence.direction === 'VI_JA';

  return (
    <div className="flex w-full flex-col gap-3 text-left text-sm">
      <div className="flex flex-wrap items-center gap-2 pr-16 text-xs text-muted-foreground">
        {score && (
          <span className={score.muted ? 'font-medium' : scoreClass(sentence.score as number)}>
            {score.text}
          </span>
        )}
        <span className="ml-auto">{formatDateTimeVN(sentence.createdAt)}</span>
      </div>

      {sentence.suggested && (
        <div className="space-y-0.5">
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
  sentences: SentenceHistoryRow[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
  toolbarStart?: ReactNode;
}) {
  const pool = useMemo(() => sentences.filter(studiable), [sentences]);
  const [shuffle, setShuffle] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [autoSpeak, setAutoSpeak] = useSessionState('flashcards.autoSpeak', false);

  const cards = useMemo(() => {
    if (!order) return pool;
    const rank = new Map(order.map((id, i) => [id, i]));
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
      className="min-h-[calc(100svh-10rem)]"
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
