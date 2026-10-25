'use client';

import type { ReactNode } from 'react';
import { Clock, GraduationCap, Ruler, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Explain } from '@/components/common/explain';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FuriganaText } from '@/components/common/furigana-text';
import { SpokenLine } from '@/components/common/spoken-line';
import { StarButton } from '@/components/common/star-button';
import { RelativeTime } from '@/components/common/relative-time';
import { formatDateTimeVN, humanizeDuration, lengthBucket, ratingLabel } from '@/lib/core/format';
import { hasFurigana } from '@/lib/japanese/furigana';
import { historyResult, type HistoryResult, type ResultTone } from '@/lib/history/result';
import { stripEmoji } from '@/lib/core/text';
import type { HistoryRow } from '@/lib/app/history';
import type { ExerciseType } from '@/lib/session/exercise-types';
import { turnLabels } from '@/lib/session/turn-labels';
import { cn } from '@/lib/core/utils';

// One tone per result (lib/history/result.ts): a word in the detail, a washed pill on the card,
// an outlined chip for a graded item. The washes are the tone tokens IconTile uses, so light and
// dark both hold. Literal strings so Tailwind sees every class.
const TONE: Record<ResultTone, { text: string; pill: string; chip: string }> = {
  alert: {
    text: 'text-alert',
    pill: 'bg-alert-wash text-alert',
    chip: 'border-alert/60 text-alert',
  },
  warn: { text: 'text-warn', pill: 'bg-warn-wash text-warn', chip: 'border-warn/60 text-warn' },
  ok: { text: 'text-ok', pill: 'bg-ok-wash text-ok', chip: 'border-ok/60 text-ok' },
  info: {
    text: 'text-info font-semibold',
    pill: 'bg-info-wash text-info',
    chip: 'border-info/60 text-info',
  },
  muted: { text: 'text-muted-foreground', pill: 'bg-muted text-muted-foreground', chip: '' },
};

const RATING_TONE: Record<number, ResultTone> = { 1: 'alert', 2: 'warn', 3: 'ok', 4: 'info' };

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  TRANSLATION: 'Dịch câu',
  QUIZ: 'Quiz',
  CLOZE: 'Điền khuyết',
  DIALOGUE: 'Hội thoại',
  CONVERSATION: 'Hội thoại',
  CLOZE_PRODUCTION: 'Điền mẫu',
  GUIDED_PRODUCTION: 'Dịch có khung',
  TEACH_BACK: 'Giảng lại',
};

export function exerciseTypeLabel(type: string): string | undefined {
  return (EXERCISE_TYPE_LABELS as Record<string, string>)[type];
}

export function dirLabel(direction: string): string {
  return direction === 'JA_VI' ? 'JP → VN' : 'VN → JP';
}

export function durationSecOf(s: HistoryRow): number | null {
  if (!s.answeredAt) return null;
  const d = (new Date(s.answeredAt).getTime() - new Date(s.createdAt).getTime()) / 1000;
  return d >= 0 && d <= 3600 ? d : null;
}

function SourceLine({
  sentence,
  truncate,
  showFurigana = true,
}: {
  sentence: HistoryRow;
  truncate?: boolean;
  showFurigana?: boolean;
}) {
  const useRuby =
    showFurigana && sentence.direction === 'JA_VI' && hasFurigana(sentence.sourceRuby);
  return (
    <p
      lang={sentence.direction === 'JA_VI' ? 'ja' : 'vi'}
      className={cn('font-medium', truncate && 'truncate')}
    >
      {useRuby ? <FuriganaText ruby={sentence.sourceRuby!} /> : sentence.sourceText}
    </p>
  );
}

function AnswerText({
  sentence,
  showFurigana = true,
}: {
  sentence: HistoryRow;
  showFurigana?: boolean;
}) {
  const useRuby =
    showFurigana && sentence.direction === 'VI_JA' && hasFurigana(sentence.suggestedRuby);
  return useRuby ? <FuriganaText ruby={sentence.suggestedRuby!} /> : <>{sentence.suggested}</>;
}

// Level, length and time taken. The card keeps each to a word or two so the row stays one line on
// a phone; the hover and the detail say the rest.
function SentenceMeta({
  level,
  charCount,
  durationSec,
  compact = false,
}: {
  level: string | null;
  charCount: number;
  durationSec?: number | null;
  compact?: boolean;
}) {
  const bucket = lengthBucket(charCount);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {level && (
        <Explain
          text={`Độ khó của lượt này — lấy theo cấp JLPT của mẫu ngữ pháp trọng tâm (${level}), không phải cấp của cả câu.`}
        >
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="size-4" aria-hidden />
            {compact ? level : `Độ khó ${level}`}
          </span>
        </Explain>
      )}
      <Explain
        text={`Độ dài câu đề: ${charCount} ký tự, xếp vào nhóm "${bucket.label}". Cỡ câu bạn chọn trong Cài đặt quyết định nhóm này.`}
      >
        <span className="inline-flex items-center gap-1">
          <Ruler className="size-4" aria-hidden />
          {compact ? `${charCount} ký tự` : `${bucket.label} · ${charCount} ký tự`}
        </span>
      </Explain>
      {durationSec != null && (
        <Explain text="Thời gian từ lúc đề hiện ra đến lúc bài được chấm. Trả lời càng lâu thì càng khó được chấm 4 Easy — app tự hạ xuống Good.">
          <span className="inline-flex items-center gap-1">
            <Timer className="size-4" aria-hidden />
            {humanizeDuration(durationSec)}
          </span>
        </Explain>
      )}
    </div>
  );
}

export function RatingChip({ expression, rating }: { expression: string; rating: number }) {
  const label = ratingLabel(rating);
  return (
    <Badge
      variant="outline"
      className={cn('text-xs', TONE[RATING_TONE[rating] ?? 'muted'].chip)}
      title={label}
      aria-label={`${expression} — ${label}`}
    >
      <span lang="ja">{expression}</span>
    </Badge>
  );
}

// The detail as thien approved it in round 1 (round 2's coloured panels were reverted): badges and
// the result in the title, the prompt with its measures, then the answers, then the graded items.
// The detail has room for a score's scale, so it reads "62/100".
export function HistoryDetail({
  sentence,
  speaker,
  rate,
  showFurigana = false,
}: {
  sentence: HistoryRow;
  speaker?: number;
  rate?: number;
  showFurigana?: boolean;
}) {
  const result = historyResult(sentence);
  const grammar = sentence.ratings.filter((r) => r.role !== 'VOCAB');
  const vocab = sentence.ratings.filter((r) => r.role === 'VOCAB');
  const typeLabel = exerciseTypeLabel(sentence.exerciseType);
  const labels = turnLabels(sentence.exerciseType, {
    prompt: 'Đề',
    answer: 'Bạn dịch',
    reference: 'Tham khảo',
    retry: '', // no menu on this surface
  });

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
          <Badge variant="secondary">{dirLabel(sentence.direction)}</Badge>
          {typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
          {result && (
            <span className={cn('text-sm font-medium', TONE[result.tone].text)}>
              {result.full.endsWith('/100') ? result.full : result.text}
            </span>
          )}
          <span className="mr-6 ml-auto text-xs font-normal text-muted-foreground">
            {formatDateTimeVN(sentence.createdAt)}
          </span>
        </DialogTitle>
        <DialogDescription className="sr-only">Chi tiết lượt dịch</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{labels.prompt}</div>
          {sentence.direction === 'JA_VI' ? (
            <SpokenLine
              text={sentence.sourceText}
              ruby={sentence.sourceRuby}
              showFurigana={showFurigana}
              speaker={speaker}
              rate={rate}
              label="Nghe đề"
            />
          ) : (
            <SourceLine sentence={sentence} showFurigana={showFurigana} />
          )}
        </div>

        <SentenceMeta
          level={sentence.level}
          charCount={sentence.charCount}
          durationSec={durationSecOf(sentence)}
        />

        <div className="space-y-2 border-t border-border/70 pt-3">
          {sentence.direction === 'VI_JA' ? (
            <div className="flex flex-wrap items-end gap-1.5">
              <span className="text-muted-foreground">{labels.answer}:</span>
              <SpokenLine
                text={sentence.userAnswer}
                showFurigana={showFurigana}
                speaker={speaker}
                rate={rate}
                label="Nghe câu bạn viết"
              />
            </div>
          ) : (
            <p>
              <span className="text-muted-foreground">{labels.answer}: </span>
              {sentence.userAnswer}
            </p>
          )}
          {sentence.suggested && (
            <div className="flex flex-wrap items-end gap-1.5">
              <span className="text-muted-foreground">{labels.reference}:</span>
              {sentence.direction === 'VI_JA' ? (
                <SpokenLine
                  text={sentence.suggested}
                  ruby={sentence.suggestedRuby}
                  showFurigana={showFurigana}
                  speaker={speaker}
                  rate={rate}
                  label="Nghe đáp án"
                />
              ) : (
                <span className="min-w-0">
                  <AnswerText sentence={sentence} showFurigana={showFurigana} />
                </span>
              )}
            </div>
          )}
          {sentence.feedback && (
            <p className="text-muted-foreground">{stripEmoji(sentence.feedback)}</p>
          )}
        </div>

        {(grammar.length > 0 || vocab.length > 0) && (
          <div className="space-y-2 border-t border-border/70 pt-3">
            {grammar.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                <span className="text-muted-foreground">Ngữ pháp:</span>
                {grammar.map((r, i) => (
                  <RatingChip key={`g-${i}`} expression={r.expression} rating={r.rating} />
                ))}
              </div>
            )}
            {vocab.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                <span className="text-muted-foreground">Từ vựng:</span>
                {vocab.map((r, i) => (
                  <RatingChip key={`v-${i}`} expression={r.expression} rating={r.rating} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DialogContent>
  );
}

// The card's three rows, the same for every turn so every card is the same height (thien, Lịch sử
// round 1): what kind of turn and when, the prompt, then its measures and its result.
function CardRows({
  sentence,
  aside,
  speaker,
  rate,
  showFurigana,
  result,
}: {
  sentence: HistoryRow;
  aside?: ReactNode;
  speaker?: number;
  rate?: number;
  showFurigana: boolean;
  result: ReactNode;
}) {
  const typeLabel = exerciseTypeLabel(sentence.exerciseType);
  return (
    <>
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{dirLabel(sentence.direction)}</Badge>
        {typeLabel && (
          <Badge variant="outline" className="min-w-0 truncate">
            {typeLabel}
          </Badge>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <RelativeTime value={sentence.createdAt} />
          {aside}
        </span>
      </div>
      <div className="flex min-h-7 min-w-0 items-end">
        {sentence.direction === 'JA_VI' ? (
          <SpokenLine
            text={sentence.sourceText}
            ruby={sentence.sourceRuby}
            showFurigana={showFurigana}
            speaker={speaker}
            rate={rate}
            label="Nghe đề"
            truncate
          />
        ) : (
          <div className="min-w-0 flex-1">
            <SourceLine sentence={sentence} truncate showFurigana={showFurigana} />
          </div>
        )}
      </div>
      <div className="mt-auto flex items-center gap-2">
        <SentenceMeta
          level={sentence.level}
          charCount={sentence.charCount}
          durationSec={durationSecOf(sentence)}
          compact
        />
        <span className="ml-auto flex shrink-0">{result}</span>
      </div>
    </>
  );
}

const PILL = 'inline-flex h-5 items-center gap-1 rounded-md px-2 text-xs font-bold tabular-nums';

function ResultPill({ result }: { result: HistoryResult | null }) {
  if (!result) return null;
  const pill = <span className={cn(PILL, TONE[result.tone].pill)}>{result.text}</span>;
  return result.full === result.text ? pill : <Explain text={result.full}>{pill}</Explain>;
}

// A turn waiting for its answer has nothing to open yet; how to answer it is one hover away.
function PendingCard({ sentence, showFurigana }: { sentence: HistoryRow; showFurigana: boolean }) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-2">
      <CardRows
        sentence={sentence}
        showFurigana={showFurigana}
        result={
          <Explain text="Trả lời qua Claude Desktop hoặc ChatGPT để được chấm. Muốn bỏ qua thì bảo trợ lý MCP «bỏ qua câu này».">
            <button
              type="button"
              className={cn(
                PILL,
                TONE.warn.pill,
                'cursor-help focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              )}
            >
              <Clock className="size-4" aria-hidden />
              Đang chờ
            </button>
          </Explain>
        }
      />
    </div>
  );
}

/** One turn in Lịch sử's card list; a click opens its detail, which the list owns. */
export function HistoryCard({
  sentence,
  speaker,
  rate,
  showFurigana = false,
  onOpen,
}: {
  sentence: HistoryRow;
  speaker?: number;
  rate?: number;
  showFurigana?: boolean;
  onOpen: () => void;
}) {
  if (sentence.status === 'PENDING') {
    return <PendingCard sentence={sentence} showFurigana={showFurigana} />;
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex h-full min-w-0 cursor-pointer flex-col gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <CardRows
        sentence={sentence}
        speaker={speaker}
        rate={rate}
        showFurigana={showFurigana}
        result={<ResultPill result={historyResult(sentence)} />}
        aside={
          // Stars live on Sentence; a v2 turn has none yet.
          sentence.kind === 'sentence' && (
            <StarButton
              id={sentence.id}
              starred={sentence.starred}
              kind="sentence"
              className="-my-1 size-6"
            />
          )
        }
      />
    </div>
  );
}
