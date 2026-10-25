'use client';

import type { ReactNode } from 'react';
import {
  BookOpen,
  CheckCheck,
  Clock,
  GraduationCap,
  ListChecks,
  MessageSquareText,
  PenLine,
  Ruler,
  Timer,
  type LucideIcon,
} from 'lucide-react';
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

// One tone per result (lib/history/result.ts), drawn four ways: a word, a pill, a washed panel
// and the detail's medal. The washes are the tone tokens IconTile uses, so light and dark both hold.
// Literal strings so Tailwind sees every class.
const TONE: Record<ResultTone, { text: string; pill: string; panel: string; medal: string }> = {
  alert: {
    text: 'text-alert',
    pill: 'bg-alert-wash text-alert',
    panel: 'border-alert/30 bg-alert-wash',
    medal: 'border-alert/40 bg-alert-wash text-alert',
  },
  warn: {
    text: 'text-warn',
    pill: 'bg-warn-wash text-warn',
    panel: 'border-warn/30 bg-warn-wash',
    medal: 'border-warn/40 bg-warn-wash text-warn',
  },
  ok: {
    text: 'text-ok',
    pill: 'bg-ok-wash text-ok',
    panel: 'border-ok/30 bg-ok-wash',
    medal: 'border-ok/40 bg-ok-wash text-ok',
  },
  info: {
    text: 'text-info',
    pill: 'bg-info-wash text-info',
    panel: 'border-info/30 bg-info-wash',
    medal: 'border-info/40 bg-info-wash text-info',
  },
  muted: {
    text: 'text-muted-foreground',
    pill: 'bg-muted text-muted-foreground',
    panel: 'border-border bg-card',
    medal: 'border-border bg-muted text-muted-foreground',
  },
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
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        TONE[RATING_TONE[rating] ?? 'muted'].pill,
      )}
    >
      <span lang="ja">{expression}</span>
      <span className="font-bold">{label}</span>
    </span>
  );
}

// The detail's result, large and in its tone: the first thing the eye finds in the dialog.
function ResultMedal({ result }: { result: HistoryResult }) {
  // A score keeps its scale under the number ("/100"); a grade says which of four it is ("1/4").
  const caption =
    result.full === result.text ? null : result.full.endsWith('/100') ? '/100' : result.full;
  return (
    <div
      className={cn(
        'flex h-14 min-w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border px-2',
        TONE[result.tone].medal,
      )}
    >
      <span
        className={cn(
          'leading-none font-bold tabular-nums',
          result.tone === 'muted' ? 'text-sm' : 'text-lg',
        )}
      >
        {result.text}
      </span>
      {caption && <span className="text-xs leading-none font-semibold opacity-80">{caption}</span>}
    </div>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <Icon className="size-4" aria-hidden />
      {children}
    </p>
  );
}

function AnswerPanel({
  tone,
  icon,
  label,
  children,
}: {
  tone: ResultTone;
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5 rounded-lg border p-3', TONE[tone].panel)}>
      <SectionLabel icon={icon}>{label}</SectionLabel>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

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
    <DialogContent className="max-h-[85vh] gap-5 overflow-y-auto sm:max-w-2xl">
      <DialogHeader className="flex-row items-center gap-3 pr-8 text-left">
        {result && <ResultMedal result={result} />}
        <div className="min-w-0 flex-1 space-y-1.5">
          <DialogTitle className="text-base font-bold">{typeLabel ?? 'Lượt dịch'}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <Badge variant="secondary">{dirLabel(sentence.direction)}</Badge>
            <span>{formatDateTimeVN(sentence.createdAt)}</span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        <section className="space-y-2 rounded-lg bg-muted/60 p-3">
          <SectionLabel icon={BookOpen}>{labels.prompt}</SectionLabel>
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
          <SentenceMeta
            level={sentence.level}
            charCount={sentence.charCount}
            durationSec={durationSecOf(sentence)}
          />
        </section>

        <div className="@container">
          <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
            <AnswerPanel tone={result?.tone ?? 'muted'} icon={PenLine} label={labels.answer}>
              {sentence.direction === 'VI_JA' ? (
                <SpokenLine
                  text={sentence.userAnswer}
                  showFurigana={showFurigana}
                  speaker={speaker}
                  rate={rate}
                  label="Nghe câu bạn viết"
                />
              ) : (
                <p>{sentence.userAnswer || '—'}</p>
              )}
            </AnswerPanel>
            {sentence.suggested && (
              <AnswerPanel tone="ok" icon={CheckCheck} label={labels.reference}>
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
                  <p>
                    <AnswerText sentence={sentence} showFurigana={showFurigana} />
                  </p>
                )}
              </AnswerPanel>
            )}
          </div>
        </div>

        {sentence.feedback && (
          <div className="flex gap-2.5 rounded-lg border border-info/30 bg-info-wash p-3">
            <MessageSquareText className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-info">Nhận xét</p>
              <p className="break-words">{stripEmoji(sentence.feedback)}</p>
            </div>
          </div>
        )}

        {(grammar.length > 0 || vocab.length > 0) && (
          <section className="space-y-2">
            <SectionLabel icon={ListChecks}>Mục được chấm</SectionLabel>
            {[
              { label: 'Ngữ pháp', list: grammar },
              { label: 'Từ vựng', list: vocab },
            ]
              .filter((g) => g.list.length > 0)
              .map((g) => (
                <div key={g.label} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">{g.label}</span>
                  {g.list.map((r, i) => (
                    <RatingChip key={i} expression={r.expression} rating={r.rating} />
                  ))}
                </div>
              ))}
          </section>
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
