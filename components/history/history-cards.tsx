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

// Rating → OUTLINE color chip (colored border + text, no fill). The 4 semantic tokens
// (alert→warn→ok→info) form a bad→great scale reused by the /100 score. `label` survives as a
// title/aria hint (color is never the sole signal — accessibility floor).
// Colour only; the LABEL comes from the single source `ratingLabel()` (lib/format) so "Again/Hard/Good/
// Easy" isn't spelled in three places (was also in lib/srs RATING_LABELS + here).
const RATING_CLASS: Record<number, string> = {
  1: 'border-alert/60 text-alert',
  2: 'border-warn/60 text-warn',
  3: 'border-ok/60 text-ok',
  4: 'border-info/60 text-info',
};

/** /100 score → the same 4-color scale as the rating chips (bad → great); colored text, not filled.
 *  Exported so the flashcard deck colours its score the same way a list card does. */
export function scoreClass(score: number): string {
  if (score < 50) return 'text-alert';
  if (score < 70) return 'text-warn';
  if (score < 90) return 'text-ok';
  return 'text-info font-semibold';
}

// Shared with the filter layer (history-filters.tsx) — one source of truth for the exercise-type copy.
// `Record<ExerciseType, …>`, not `Record<string, …>`: this table also GENERATES the /history type
// filter, so a type missing from it cannot be filtered for at all — the learner's own practice goes
// missing from their history with no error anywhere. The compiler now refuses an incomplete table.
export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  TRANSLATION: 'Dịch câu',
  QUIZ: 'Quiz',
  CLOZE: 'Điền khuyết',
  DIALOGUE: 'Hội thoại',
  // Situational PRODUCTION practice (2026-07-23): sourceText is the scenario brief and userAnswer is
  // the learner's own Japanese utterance. Shares the "Hội thoại" label with DIALOGUE per the user's
  // 2026-07-24 request (the two read the same to the learner).
  CONVERSATION: 'Hội thoại',
  // The two scaffolded PRODUCTION rungs (2026-07-26). Named by what the learner DID, not by rung
  // number — the ladder is deliberately invisible in the UI (a rung is support, never a rank).
  CLOZE_PRODUCTION: 'Điền mẫu',
  GUIDED_PRODUCTION: 'Dịch có khung',
  // The learner explains the pattern in their own words and the explanation is graded (2026-07-27).
  TEACH_BACK: 'Giảng lại',
};

/**
 * Label for an exercise type as it comes OUT OF THE DATABASE — i.e. a plain `string`, which is what
 * `Sentence.exerciseType` is. `undefined` for a value the table does not know, and every caller already
 * treats that as "no badge".
 *
 * The pair is the point: the TABLE is exhaustive (the compiler refuses a missing type, so a new type
 * cannot silently vanish from the /history filter that is generated from it), while READING it tolerates
 * an unknown string — because a row written by an older version of the app is data, not a type error.
 */
export function exerciseTypeLabel(type: string): string | undefined {
  return (EXERCISE_TYPE_LABELS as Record<string, string>)[type];
}

/** Direction as a compact code badge, e.g. "JP → VN" / "VN → JP". Shared with the community feed. */
export function dirLabel(direction: string): string {
  return direction === 'JA_VI' ? 'JP → VN' : 'VN → JP';
}

/** Time-to-answer in seconds (answeredAt − createdAt), or null when it can't be trusted / is absent. */
export function durationSecOf(s: SentenceHistoryRow): number | null {
  if (!s.answeredAt) return null;
  const d = (new Date(s.answeredAt).getTime() - new Date(s.createdAt).getTime()) / 1000;
  return d >= 0 && d <= 3600 ? d : null;
}

/** The đề line — with hover-furigana when Claude annotated the JA source, plain text otherwise. */
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

/** The reference-answer content — hover-furigana when Claude annotated the JA answer (VI_JA), plain otherwise. */
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

/**
 * Compact meta line SHARED by both history card types (Của tôi + Cộng đồng): độ khó (target pattern's
 * JLPT level) · độ dài (length bucket + char count) · chủ đề (context tag) · thời gian làm bài
 * (only the owner's own card has it). Each part renders only when its data exists. Lucide icons only.
 */
export function SentenceMeta({
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

/**
 * The shared COMPACT card frame for both history tabs (extracted so "Của tôi" and "Cộng đồng" are the
 * same visual family — same shell, header row, spacing; they differ only in the header's trailing icons
 * and the modal content). A click / Enter / Space opens the detail modal supplied via `dialog`.
 * `header` fills the top row (text-xs muted); `children` are the body (đề line + <SentenceMeta>).
 */
export function SentenceCardShell({
  header,
  children,
  dialog,
  autoOpen = false,
}: {
  header: ReactNode;
  children: ReactNode;
  dialog: (close: () => void) => ReactNode;
  /** Open the detail modal automatically when this flips to true (a just-graded card). Opens once per
   * arm — it never re-opens after the user closes it (the effect only fires on the false→true edge). */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Opening the modal is a genuine side effect driven by an external edge (the parent arms `autoOpen`
    // when this card just got graded) — not render-derivable state; it fires once per arm.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) setOpen(true);
  }, [autoOpen]);
  return (
    <li className="h-full">
      {/* role="button" DIV (not a <button>) so inline controls (audio / star / share) can be REAL
          <button>s — a button nested in a button is invalid HTML. Keyboard mirrors a native button. */}
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

/** A colored rating chip carrying the pattern/word text. (Audio for patterns lives on /resources now.)
 *  Exported so the flashcard deck shows the same chip as the detail modal — one chip, one colour scale. */
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

/**
 * Full detail of a graded/skipped sentence, in a modal (replaced the old inline expand, 2026-07-18):
 * đề (+ audio) · bạn dịch · bản dịch tham khảo (audio sits BETWEEN the "Tham khảo" label and the
 * answer) · nhận xét · a ngữ pháp / từ vựng row (grammar chips each carry an audio button so you can
 * hear the pattern). Audio buttons align to the JA text baseline (items-end), not centered over furigana.
 */
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
  // The web's translation wording is DELIBERATELY shorter than the chat block's ("Đề", not
  // "Đề (Nhật → Việt)") — a direction badge sits right above this. Shared table, own default.
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
          {/* mr-6 keeps the timestamp clear of the dialog's top-right close button. */}
          <span className="mr-6 ml-auto text-xs font-normal text-muted-foreground">
            {formatDateTimeVN(sentence.createdAt)}
          </span>
        </DialogTitle>
        <DialogDescription className="sr-only">Chi tiết lượt dịch</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        {/* Đề — JA source gets the karaoke play line (chars light up in the theme color with the audio);
            a VI đề is plain text (no JA audio). The HEADING follows the exercise type: on a quiz, a
            teach-back or a conversation the learner was not given a sentence to translate, and calling
            it "Đề" beside a badge reading "Quiz" contradicts itself on one screen (found 2026-08-12 —
            the chat block had already been fixed three times while this copy of the labels sat here). */}
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
          {/* VI→JA (and CONVERSATION): the answer the learner wrote IS Japanese content, so it gets the
              same play + karaoke line as the đề (invariant #9). No ruby column exists for it, so it
              degrades to audio + highlight without furigana. JA→VI answers are Vietnamese → plain. */}
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
            // VI→JA: reference is Japanese → karaoke play line right after "Tham khảo:". JA→VI answers
            // are Vietnamese → plain text (that side's audio is the đề above).
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

        {/* Ngữ pháp + Từ vựng on their own rows. (Pattern audio lives on /resources now, not here.) */}
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

        {/* Share to the members' feed — only a GRADED attempt can be shared. */}
      </div>
    </DialogContent>
  );
}

/**
 * Staged-but-unanswered sentence. The reference is frozen but kept HIDDEN while waiting so the answer
 * isn't spoiled. Skipping is NOT a web action anymore — it happens in Claude Desktop (the tutor owns the
 * loop), so the card just tells the learner how to answer or skip there.
 */
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

/** A compact history card that opens the full detail in a modal on click (graded/skipped rows). */
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
  /** Auto-open this card's detail modal (a card that just got graded on this tab). */
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
      {/* đề — truncated to ONE line so every card is the same shape. JA source gets the karaoke play
          line (progress sweep + furigana); a VI đề is plain text. Speed control is modal-only (kept
          off the dense card). */}
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
