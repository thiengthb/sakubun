'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { Clock, GraduationCap, Info, Ruler, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Explain } from '@/components/shared/explain';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FuriganaText } from '@/components/shared/furigana-text';
import { SpeakButton } from '@/components/shared/speak-button';
import { SpokenLine } from '@/components/shared/spoken-line';
import { StarButton } from '@/components/shared/star-button';
import { RelativeTime } from '@/components/shared/relative-time';
import { formatDateTimeVN, humanizeDuration, lengthBucket, ratingLabel } from '@/lib/format';
import { hasFurigana } from '@/lib/furigana';
import { scoreLabel } from '@/lib/score-label';
import { stripEmoji } from '@/lib/text';
import type { SentenceHistoryRow } from '@/lib/practice';
import type { ExerciseType } from '@/lib/exercise-types';
import { turnLabels } from '@/lib/turn-labels';
import { cn } from '@/lib/utils';

const RATING_CLASS: Record<number, string> = {
  1: 'border-alert/60 text-alert',
  2: 'border-warn/60 text-warn',
  3: 'border-ok/60 text-ok',
  4: 'border-info/60 text-info',
};

export function scoreClass(score: number): string {
  if (score < 50) return 'text-alert';
  if (score < 70) return 'text-warn';
  if (score < 90) return 'text-ok';
  return 'text-info font-semibold';
}

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

export function durationSecOf(s: SentenceHistoryRow): number | null {
  if (!s.answeredAt) return null;
  const d = (new Date(s.answeredAt).getTime() - new Date(s.createdAt).getTime()) / 1000;
  return d >= 0 && d <= 3600 ? d : null;
}

function SourceLine({
  sentence,
  truncate,
  showFurigana = true,
}: {
  sentence: SentenceHistoryRow;
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
  sentence: SentenceHistoryRow;
  showFurigana?: boolean;
}) {
  const useRuby =
    showFurigana && sentence.direction === 'VI_JA' && hasFurigana(sentence.suggestedRuby);
  return useRuby ? <FuriganaText ruby={sentence.suggestedRuby!} /> : <>{sentence.suggested}</>;
}

function SentenceMeta({
  level,
  charCount,
  durationSec,
}: {
  level: string | null;
  charCount: number;
  durationSec?: number | null;
}) {
  const bucket = lengthBucket(charCount);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {level && (
        <Explain
          text={`Độ khó của lượt này — lấy theo cấp JLPT của mẫu ngữ pháp trọng tâm (${level}), không phải cấp của cả câu.`}
        >
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="size-3.5" aria-hidden />
            Độ khó {level}
          </span>
        </Explain>
      )}
      <Explain
        text={`Độ dài câu đề: ${charCount} ký tự, xếp vào nhóm "${bucket.label}". Cỡ câu bạn chọn trong Cài đặt quyết định nhóm này.`}
      >
        <span className="inline-flex items-center gap-1">
          <Ruler className="size-3.5" aria-hidden />
          {bucket.label} · {charCount} ký tự
        </span>
      </Explain>
      {durationSec != null && (
        <Explain text="Thời gian từ lúc đề hiện ra đến lúc bài được chấm. Trả lời càng lâu thì càng khó được chấm 4 Easy — app tự hạ xuống Good.">
          <span className="inline-flex items-center gap-1">
            <Timer className="size-3.5" aria-hidden />
            {humanizeDuration(durationSec)}
          </span>
        </Explain>
      )}
    </div>
  );
}

function SentenceCardShell({
  header,
  children,
  dialog,
  autoOpen = false,
}: {
  header: ReactNode;
  children: ReactNode;
  dialog: (close: () => void) => ReactNode;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) setOpen(true);
  }, [autoOpen]);
  return (
    <li className="h-full">
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-full cursor-pointer flex-col gap-2 rounded-lg border border-border/70 p-4 text-left transition-colors hover:border-border hover:bg-muted/40"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {header}
        </div>
        {children}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        {dialog(() => setOpen(false))}
      </Dialog>
    </li>
  );
}

export function RatingChip({ expression, rating }: { expression: string; rating: number }) {
  const label = ratingLabel(rating);
  return (
    <Badge
      variant="outline"
      className={cn('text-xs', RATING_CLASS[rating])}
      title={label}
      aria-label={`${expression} — ${label}`}
    >
      <span lang="ja">{expression}</span>
    </Badge>
  );
}

function HistoryDetail({
  sentence,
  speaker,
  rate,
  showFurigana = false,
}: {
  sentence: SentenceHistoryRow;
  speaker?: number;
  rate?: number;
  showFurigana?: boolean;
}) {
  const detailScore = scoreLabel(sentence.status, sentence.score);
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
          {detailScore && (
            <span
              className={cn(
                'text-sm font-medium',
                detailScore.muted
                  ? 'text-muted-foreground'
                  : scoreClass(sentence.score as number),
              )}
            >
              {detailScore.text}
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

function PendingCard({ sentence }: { sentence: SentenceHistoryRow }) {
  return (
    <li className="flex h-full flex-col gap-2 rounded-lg border border-warn/40 bg-warn/5 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{dirLabel(sentence.direction)}</Badge>
        <span className="flex items-center gap-1 font-medium text-warn">
          <Clock className="size-3.5" aria-hidden />
          Đang chờ trả lời
        </span>
        <RelativeTime value={sentence.createdAt} className="ml-auto" />
      </div>
      <div className="flex items-end gap-2">
        {sentence.direction === 'JA_VI' && (
          <SpeakButton text={sentence.sourceText} label="Nghe đề" />
        )}
        <div className="min-w-0 flex-1">
          <SourceLine sentence={sentence} truncate />
        </div>
      </div>
      <div className="mt-auto flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          Trả lời bên Claude Desktop để được chấm. Muốn bỏ qua thì bảo Claude «bỏ qua câu này».
        </span>
      </div>
    </li>
  );
}

export function HistoryCard({
  sentence,
  speaker,
  rate,
  showFurigana = false,
  autoOpen = false,
}: {
  sentence: SentenceHistoryRow;
  speaker?: number;
  rate?: number;
  showFurigana?: boolean;
  autoOpen?: boolean;
}) {
  if (sentence.status === 'PENDING') return <PendingCard sentence={sentence} />;
  const score = scoreLabel(sentence.status, sentence.score);
  const typeLabel = exerciseTypeLabel(sentence.exerciseType);

  return (
    <SentenceCardShell
      autoOpen={autoOpen}
      header={
        <>
          <Badge variant="secondary">{dirLabel(sentence.direction)}</Badge>
          {typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
          {score && (
            <span
              className={cn(
                'font-medium',
                score.muted ? 'text-muted-foreground' : scoreClass(sentence.score as number),
              )}
            >
              {score.text}
            </span>
          )}
          <RelativeTime value={sentence.createdAt} className="ml-auto" />
          <StarButton
            id={sentence.id}
            starred={sentence.starred}
            kind="sentence"
            className="-my-1 size-6"
          />
        </>
      }
      dialog={() => (
        <HistoryDetail
          sentence={sentence}
          speaker={speaker}
          rate={rate}
          showFurigana={showFurigana}
        />
      )}
    >
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
        <div className="min-w-0">
          <SourceLine sentence={sentence} truncate showFurigana={showFurigana} />
        </div>
      )}
      <SentenceMeta
        level={sentence.level}
        charCount={sentence.charCount}
        durationSec={durationSecOf(sentence)}
      />
    </SentenceCardShell>
  );
}
