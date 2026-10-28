'use client';

import { useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { IconAction } from '@/components/common/icon-action';
import { SpokenLine } from '@/components/common/spoken-line';
import { StarButton } from '@/components/common/star-button';
import {
  RATING_TONE,
  ResultPill,
  TONE,
  dirLabel,
  durationSecOf,
  exerciseTypeChip,
} from '@/components/features/history/history-shared';
import { humanizeDuration, ratingLabel } from '@/lib/core/format';
import { timeOfDay } from '@/lib/history/days';
import { historyResult } from '@/lib/history/result';
import { stripEmoji } from '@/lib/core/text';
import { turnLabels } from '@/lib/session/turn-labels';
import type { HistoryRow } from '@/lib/app/history';
import { cn } from '@/lib/core/utils';

// A turn's detail (thien, 7.4 History Detail B): a panel on the right, so the timeline stays in sight
// and a click on another row shows that one; ← → (buttons or arrow keys) step through the list. The
// learner's answer and the reference sit side by side to compare. On a phone the panel fills the
// screen.

/** A graded item: its kind and expression, coloured by how the learner did on it. */
function RatingChip({
  kind,
  expression,
  rating,
}: {
  kind: string;
  expression: string;
  rating: number;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(TONE[RATING_TONE[rating] ?? 'muted'].chip)}
      aria-label={`${kind} ${expression}: ${ratingLabel(rating)}`}
    >
      {kind} · <span lang="ja">{expression}</span>
    </Badge>
  );
}

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/60 px-2.5 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Detail({
  sentence,
  speaker,
  rate,
  showFurigana,
}: {
  sentence: HistoryRow;
  speaker?: number;
  rate?: number;
  showFurigana: boolean;
}) {
  const labels = turnLabels(sentence.exerciseType, {
    prompt: '',
    answer: 'Bạn dịch',
    reference: 'Tham khảo',
    retry: '', // no menu on this surface
  });
  const type = exerciseTypeChip(sentence.exerciseType);
  const duration = durationSecOf(sentence);
  const japaneseAnswer = sentence.direction === 'VI_JA';
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{dirLabel(sentence.direction)}</Badge>
        {sentence.level && <Badge variant="outline">{sentence.level}</Badge>}
        {type && <Badge variant="outline">{type}</Badge>}
        <ResultPill result={historyResult(sentence)} />
        <span className="ml-auto text-xs text-muted-foreground">
          {timeOfDay(sentence.createdAt)}
          {duration != null && ` · ${humanizeDuration(duration)}`}
        </span>
      </div>

      <div className="space-y-1">
        {labels.prompt && <div className="text-xs text-muted-foreground">{labels.prompt}</div>}
        {sentence.direction === 'JA_VI' ? (
          <SpokenLine
            lookup
            text={sentence.sourceText}
            ruby={sentence.sourceRuby}
            showFurigana={showFurigana}
            speaker={speaker}
            rate={rate}
            label="Nghe đề"
            className="text-lg"
          />
        ) : (
          <p lang="vi" className="text-lg font-medium">
            {sentence.sourceText}
          </p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Box label={labels.answer}>
          {japaneseAnswer ? (
            <SpokenLine
              lookup
              text={sentence.userAnswer}
              speaker={speaker}
              rate={rate}
              label="Nghe câu bạn viết"
              className="font-normal"
            />
          ) : (
            <p>{sentence.userAnswer}</p>
          )}
        </Box>
        {sentence.suggested && (
          <Box label={labels.reference}>
            {japaneseAnswer ? (
              <SpokenLine
                lookup
                text={sentence.suggested}
                ruby={sentence.suggestedRuby}
                showFurigana={showFurigana}
                speaker={speaker}
                rate={rate}
                label="Nghe đáp án"
                className="font-normal"
              />
            ) : (
              <p>{sentence.suggested}</p>
            )}
          </Box>
        )}
      </div>

      {sentence.feedback && (
        <p>
          <span className="text-muted-foreground">Nhận xét: </span>
          {stripEmoji(sentence.feedback)}
        </p>
      )}

      {sentence.ratings.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">Đối tượng:</span>
          {sentence.ratings.map((r, i) => (
            <RatingChip
              key={i}
              kind={r.role === 'VOCAB' ? 'Từ vựng' : 'Ngữ pháp'}
              expression={r.expression}
              rating={r.rating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoryDetailPanel({
  rows,
  openId,
  onOpen,
  onClose,
  speaker,
  rate,
  showFurigana,
}: {
  /** The turns the panel steps through, in the timeline's order (waiting ones left out). */
  rows: HistoryRow[];
  openId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  speaker?: number;
  rate?: number;
  showFurigana: boolean;
}) {
  const index = openId ? rows.findIndex((r) => r.id === openId) : -1;
  const sentence = index >= 0 ? rows[index] : undefined;
  const prev = index > 0 ? rows[index - 1] : undefined;
  const next = index >= 0 && index < rows.length - 1 ? rows[index + 1] : undefined;

  // The arrow keys step through the turns while the panel is open, as its buttons do.
  useEffect(() => {
    if (!sentence) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const to = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : undefined;
      if (!to) return;
      e.preventDefault();
      onOpen(to.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sentence, prev, next, onOpen]);

  return (
    <Sheet open={sentence != null} onOpenChange={(o) => !o && onClose()} modal={false}>
      {sentence && (
        <SheetContent
          overlay={false}
          showCloseButton={false}
          className={cn(
            'gap-3 overflow-y-auto p-4 data-[side=right]:w-full data-[side=right]:sm:max-w-md',
            showFurigana && '[&_.furigana_rt]:visible',
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
          // A click on another row of the timeline shows that turn instead of closing the panel.
          onInteractOutside={(e) => {
            const target = e.target instanceof Element ? e.target : null;
            if (target?.closest('[data-history-row], [data-radix-popper-content-wrapper]'))
              e.preventDefault();
          }}
        >
          <div className="flex items-center gap-1.5">
            <IconAction
              icon={ChevronLeft}
              label="Lượt trước"
              variant="outline"
              disabled={!prev}
              onClick={() => prev && onOpen(prev.id)}
            />
            <IconAction
              icon={ChevronRight}
              label="Lượt sau"
              variant="outline"
              disabled={!next}
              onClick={() => next && onOpen(next.id)}
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {index + 1} / {rows.length}
            </span>
            <span className="ml-auto flex items-center gap-0.5">
              {/* Stars live on Sentence; a v2 turn has none yet. */}
              {sentence.kind === 'sentence' && (
                <StarButton id={sentence.id} starred={sentence.starred} kind="sentence" />
              )}
              <SheetClose asChild>
                <IconAction icon={X} label="Đóng" />
              </SheetClose>
            </span>
          </div>
          <SheetTitle className="sr-only">Chi tiết lượt dịch</SheetTitle>
          <SheetDescription className="sr-only">{sentence.sourceText}</SheetDescription>
          <Detail sentence={sentence} speaker={speaker} rate={rate} showFurigana={showFurigana} />
        </SheetContent>
      )}
    </Sheet>
  );
}
