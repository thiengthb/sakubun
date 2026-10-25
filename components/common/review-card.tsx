'use client';

import { Check, X } from 'lucide-react';
import { SpeakButton } from '@/components/common/speak-button';
import { SpokenLine } from '@/components/common/spoken-line';
import type { QuickCard } from '@/lib/app/quick-review';
import type { Segment } from '@/lib/domain/sentence';
import { cn } from '@/lib/core/utils';
import { Badge } from '@/components/ui/badge';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';

// The one card of quick review (decision 0001, flashcard style B "context first"): the item stands
// in a real sentence, underlined on a flip card or blanked on a cloze, and the explanation opens
// below it once the learner has answered or asked to see it.

export interface CardTts {
  voiceSpeaker?: number;
  speechRate?: number;
}

const QUESTION: Record<QuickCard['mode'], Record<QuickCard['kind'], string>> = {
  flip: { VOCAB: 'Từ gạch chân nghĩa là gì?', GRAMMAR: 'Mẫu gạch chân nói lên điều gì?' },
  cloze: { VOCAB: 'Chọn từ hợp với chỗ trống', GRAMMAR: 'Chọn mẫu hợp với chỗ trống' },
};

export function Sentence({
  segments,
  fill,
  showFurigana,
}: {
  segments: Segment[];
  fill: string | null;
  showFurigana: boolean;
}) {
  return (
    <p lang="ja" className="furigana text-2xl leading-loose font-medium sm:text-3xl">
      {segments.map((s, i) => {
        if (s.mark === 'blank') {
          return fill ? (
            <span key={i} className="mx-0.5 border-b-2 border-ok font-semibold text-ok">
              {fill}
            </span>
          ) : (
            <span
              key={i}
              aria-label="chỗ trống"
              className="mx-1 inline-block h-lh w-16 border-b-2 border-foreground align-bottom"
            >
              {'​'}
            </span>
          );
        }
        const target =
          s.mark === 'target' &&
          'font-semibold text-accent-brand underline decoration-2 underline-offset-8';
        return s.reading ? (
          <ruby key={i} className={cn(target)}>
            {s.text}
            <rt className={showFurigana ? 'visible' : 'invisible'}>{s.reading}</rt>
          </ruby>
        ) : (
          <span key={i} className={cn(target)}>
            {s.text}
          </span>
        );
      })}
    </p>
  );
}

export function spokenText(segments: Segment[], fill: string): string {
  return segments.map((s) => (s.mark === 'blank' ? fill : s.text)).join('');
}

export function ReviewCard({
  card,
  picked,
  revealed,
  showFurigana,
  tts,
  onPick,
}: {
  card: QuickCard;
  picked: string | null;
  revealed: boolean;
  showFurigana: boolean;
  tts: CardTts;
  onPick: (choiceId: string) => void;
}) {
  const answered = card.mode === 'cloze' ? picked !== null : revealed;
  const right = card.mode === 'cloze' && picked === card.itemId;
  const segments = card.sentence?.segments ?? null;
  const ruby = buildFuriganaMarkup(card.expression, card.reading);

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{card.kind === 'VOCAB' ? 'Từ vựng' : 'Ngữ pháp'}</Badge>
          {card.level && <Badge variant="outline">{card.level}</Badge>}
          {card.isNew && <Badge variant="secondary">Mới</Badge>}
        </div>
        <p className="text-base font-bold">{QUESTION[card.mode][card.kind]}</p>
      </div>

      {segments ? (
        <div className="flex items-start gap-2">
          <Sentence
            segments={segments}
            fill={card.mode === 'cloze' && answered ? card.expression : null}
            showFurigana={showFurigana}
          />
          {answered && (
            <SpeakButton
              text={spokenText(segments, card.expression)}
              label="Nghe câu"
              speaker={tts.voiceSpeaker}
              rate={tts.speechRate}
              className="mt-2 shrink-0"
            />
          )}
        </div>
      ) : (
        // No example sentence yet: the item alone, framed so the card does not look empty.
        <div className="flex justify-center rounded-lg border-2 border-border bg-card px-4 py-8 text-center shadow-lift-card">
          <SpokenLine
            text={card.expression}
            ruby={ruby}
            showFurigana={showFurigana}
            speaker={tts.voiceSpeaker}
            rate={tts.speechRate}
            label="Nghe"
            className="text-2xl leading-snug font-semibold sm:text-3xl"
          />
        </div>
      )}

      {card.mode === 'cloze' && (
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Chọn đáp án">
          {card.choices.map((choice, i) => {
            const isAnswer = choice.itemId === card.itemId;
            const isPicked = choice.itemId === picked;
            return (
              <button
                key={choice.itemId}
                type="button"
                disabled={answered}
                onClick={() => onPick(choice.itemId)}
                // A Duolingo answer tile: a raised card that presses down; once answered, the
                // right one turns green, a wrong pick red, and the rest step back.
                className={cn(
                  'mb-0.5 flex min-h-14 items-center gap-3 rounded-lg border-2 px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  !answered &&
                    'border-control-edge bg-card shadow-lift hover:bg-muted active:translate-y-0.5 active:shadow-none',
                  answered && isAnswer && 'border-ok bg-ok-wash text-ok',
                  answered &&
                    isPicked &&
                    !isAnswer &&
                    'border-destructive bg-alert-wash text-destructive',
                  answered && !isAnswer && !isPicked && 'border-control-edge bg-card opacity-50',
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-sm border-2 border-current/20 text-xs font-semibold opacity-80">
                  {i + 1}
                </span>
                <span lang="ja" className="text-lg font-medium">
                  {choice.expression}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {answered && (
        <div className="space-y-2.5 rounded-lg border-2 border-border bg-card p-4 shadow-lift-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <SpokenLine
              text={card.expression}
              ruby={ruby}
              showFurigana={showFurigana}
              speaker={tts.voiceSpeaker}
              rate={tts.speechRate}
              label="Nghe"
              className="text-2xl font-bold"
            />
            {card.reading && (
              <span lang="ja" className="text-muted-foreground">
                {card.reading}
              </span>
            )}
            {card.hanviet && (
              <span className="rounded-md border px-1.5 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {card.hanviet}
              </span>
            )}
          </div>
          <p className="text-lg font-semibold">{card.meaningVi}</p>
          {card.structure && (
            <p>
              <span className="font-semibold">Cấu trúc</span>{' '}
              <span lang="ja">{card.structure}</span>
            </p>
          )}
          {card.sentence?.translation && (
            <p className="text-muted-foreground">{card.sentence.translation}</p>
          )}
          {card.note && (
            <p className="rounded-sm bg-warn-wash px-3 py-2">
              <span className="font-semibold">Lưu ý</span> {card.note}
            </p>
          )}
          {card.mode === 'cloze' && (
            <p
              className={cn(
                'flex items-center gap-1.5 font-semibold',
                right ? 'text-ok' : 'text-destructive',
              )}
            >
              {right ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <X className="size-4" aria-hidden />
              )}
              {right ? 'Đúng, tính là Nhớ.' : 'Chưa đúng, tính là Chưa nhớ.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
