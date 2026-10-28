'use client';

import { Clock } from 'lucide-react';
import { Explain } from '@/components/common/explain';
import type { HistoryResult, ResultTone } from '@/lib/history/result';
import type { HistoryRow } from '@/lib/app/history';
import type { ExerciseType } from '@/lib/session/exercise-types';
import { cn } from '@/lib/core/utils';

// What the timeline rows and the detail panel share: the tones, the labels, the result pill.

// One tone per result (lib/history/result.ts): a word in the detail, a washed pill on a row, an
// outlined chip for a graded item, a segment of a day's bar. The washes are the tone tokens IconTile
// uses, so light and dark both hold. Literal strings so Tailwind sees every class.
export const TONE: Record<ResultTone, { text: string; pill: string; chip: string; bar: string }> = {
  alert: {
    text: 'text-alert',
    pill: 'bg-alert-wash text-alert',
    chip: 'border-alert/60 text-alert',
    bar: 'bg-alert',
  },
  warn: {
    text: 'text-warn',
    pill: 'bg-warn-wash text-warn',
    chip: 'border-warn/60 text-warn',
    bar: 'bg-warn',
  },
  ok: { text: 'text-ok', pill: 'bg-ok-wash text-ok', chip: 'border-ok/60 text-ok', bar: 'bg-ok' },
  info: {
    text: 'text-info font-semibold',
    pill: 'bg-info-wash text-info',
    chip: 'border-info/60 text-info',
    bar: 'bg-info',
  },
  muted: {
    text: 'text-muted-foreground',
    pill: 'bg-muted text-muted-foreground',
    chip: '',
    bar: 'bg-muted-foreground/40',
  },
};

export const RATING_TONE: Record<number, ResultTone> = {
  1: 'alert',
  2: 'warn',
  3: 'ok',
  4: 'info',
};

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

/** The exercise's chip, or nothing for a plain translation: nearly every turn is one (thien, 7.4). */
export function exerciseTypeChip(type: string): string | undefined {
  return type === 'TRANSLATION'
    ? undefined
    : (EXERCISE_TYPE_LABELS as Record<string, string>)[type];
}

export function dirLabel(direction: string): string {
  return direction === 'JA_VI' ? 'JP → VN' : 'VN → JP';
}

export function durationSecOf(s: HistoryRow): number | null {
  if (!s.answeredAt) return null;
  const d = (new Date(s.answeredAt).getTime() - new Date(s.createdAt).getTime()) / 1000;
  return d >= 0 && d <= 3600 ? d : null;
}

const PILL = 'inline-flex h-5 items-center gap-1 rounded-md px-2 text-xs font-bold tabular-nums';

export function ResultPill({ result }: { result: HistoryResult | null }) {
  if (!result) return null;
  const pill = <span className={cn(PILL, TONE[result.tone].pill)}>{result.text}</span>;
  return result.full === result.text ? pill : <Explain text={result.full}>{pill}</Explain>;
}

// A turn waiting for its answer has nothing to open yet; how to answer it is one hover away. A
// button only so its tooltip also opens on focus.
export function PendingPill() {
  return (
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
  );
}
