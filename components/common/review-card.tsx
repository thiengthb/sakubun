'use client';

import type { ReactNode } from 'react';
import { SpeakButton } from '@/components/common/speak-button';
import { SpokenLine } from '@/components/common/spoken-line';
import type { QuickCard } from '@/lib/app/quick-review';
import type { Segment } from '@/lib/domain/sentence';
import { cn } from '@/lib/core/utils';
import { Badge } from '@/components/ui/badge';
import { choiceLabel } from '@/lib/domain/quiz-class';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';

// The one card of quick review (decision 0001, flashcard style B "context first"): the item stands
// in a real sentence, underlined on a flip card or blanked on a cloze, and the explanation opens
// below it once the learner has answered or asked to see it. A new item is met on an intro card: the
// explanation is open from the start and nothing is asked (docs/plans/2026-10-28-quick-review.md, C4).

export interface CardTts {
  voiceSpeaker?: number;
  speechRate?: number;
}

const QUESTION: Record<'intro' | 'flip' | 'bare' | 'cloze', Record<QuickCard['kind'], string>> = {
  intro: { VOCAB: 'Từ mới: đọc câu và nghĩa', GRAMMAR: 'Mẫu mới: đọc câu và cách dùng' },
  flip: { VOCAB: 'Từ gạch chân nghĩa là gì?', GRAMMAR: 'Mẫu gạch chân nói lên điều gì?' },
  // A flip card with no example sentence: the item stands alone.
  bare: { VOCAB: 'Từ này nghĩa là gì?', GRAMMAR: 'Mẫu này nói lên điều gì?' },
  cloze: { VOCAB: 'Chọn từ hợp với chỗ trống', GRAMMAR: 'Chọn mẫu hợp với chỗ trống' },
};

export function Sentence({
  segments,
  fill,
  showFurigana,
  lookup = false,
  hideTarget = false,
}: {
  segments: Segment[];
  fill: string | null;
  showFurigana: boolean;
  /** The hover lookup on its words (7.4b); `hideTarget` keeps the word under review out of it. */
  lookup?: boolean;
  hideTarget?: boolean;
}) {
  return (
    <p
      lang="ja"
      data-lookup={lookup || undefined}
      className="furigana text-2xl leading-loose font-medium sm:text-3xl"
    >
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
        const hide = (hideTarget && s.mark === 'target') || undefined;
        return s.reading ? (
          <ruby key={i} className={cn(target)} data-lookup-hide={hide}>
            {s.text}
            <rt className={showFurigana ? 'visible' : 'invisible'}>{s.reading}</rt>
          </ruby>
        ) : (
          <span key={i} className={cn(target)} data-lookup-hide={hide}>
            {s.text}
          </span>
        );
      })}
    </p>
  );
}

/** Tapping anywhere on the question plays it: a pointer shortcut to the speak button inside, which
 * stays the control for keyboard and screen reader. */
function TapToHear({
  active,
  className,
  children,
}: {
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(active && 'cursor-pointer', className)}
      onClick={(e) => {
        if (!active || (e.target as HTMLElement).closest('button')) return;
        e.currentTarget.querySelector<HTMLButtonElement>('button')?.click();
      }}
    >
      {children}
    </div>
  );
}

export function spokenText(segments: Segment[], fill: string): string {
  return segments.map((s) => (s.mark === 'blank' ? fill : s.text)).join('');
}

export function ReviewCard({
  card,
  intro = false,
  picked,
  revealed,
  showFurigana,
  tts,
  onPick,
}: {
  card: QuickCard;
  // Met for the first time: the answer is shown at once, and the card asks nothing.
  intro?: boolean;
  picked: string | null;
  revealed: boolean;
  showFurigana: boolean;
  tts: CardTts;
  onPick: (choiceId: string) => void;
}) {
  const answered = card.mode === 'cloze' ? picked !== null : revealed || intro;
  const segments = card.sentence?.segments ?? null;
  const ruby = buildFuriganaMarkup(card.expression, card.reading);
  // The question already shows a word's kanji, so its answer leads with the reading; a grammar
  // pattern leads with itself, since the sentence shows only one form of it, without the English
  // label some patterns carry (〜から（reason） is 〜から).
  const heading =
    card.kind === 'VOCAB' && card.reading ? card.reading : choiceLabel(card.expression);
  // A cloze puts back the text it blanked (より), not the pattern's name (〜より).
  const fill = card.mode === 'cloze' ? card.answer : card.expression;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{card.kind === 'VOCAB' ? 'Từ vựng' : 'Ngữ pháp'}</Badge>
          {card.level && <Badge variant="outline">{card.level}</Badge>}
          {card.isNew && <Badge variant="secondary">Mới</Badge>}
        </div>
        <p className="text-base font-bold">
          {
            QUESTION[intro ? 'intro' : card.mode === 'flip' && !segments ? 'bare' : card.mode][
              card.kind
            ]
          }
        </p>
      </div>

      {segments ? (
        // The sentence plays when tapped; its button sits left, centred on the first line. A cloze
        // stays silent until answered, since the sentence read aloud would give the answer away.
        <TapToHear
          active={card.mode === 'flip' || answered}
          className="flex items-start justify-center gap-2 py-8 text-2xl leading-loose sm:text-3xl md:py-16"
        >
          {(card.mode === 'flip' || answered) && (
            <span className="flex h-lh shrink-0 items-center">
              <SpeakButton
                text={spokenText(segments, fill)}
                label="Nghe câu"
                speaker={tts.voiceSpeaker}
                rate={tts.speechRate}
              />
            </span>
          )}
          <Sentence
            segments={segments}
            fill={card.mode === 'cloze' && answered ? fill : null}
            showFurigana={showFurigana}
            lookup
            hideTarget={!answered}
          />
        </TapToHear>
      ) : (
        // No example sentence yet: the item alone in the middle of the free space, unframed; only
        // the answer below is a card.
        <TapToHear active className="flex flex-col items-center justify-center gap-2 py-8 md:py-16">
          <SpokenLine
            text={card.expression}
            ruby={ruby}
            showFurigana={showFurigana}
            speaker={tts.voiceSpeaker}
            rate={tts.speechRate}
            label="Nghe"
            className="text-2xl leading-loose font-semibold sm:text-3xl"
          />
          <p className="text-muted-foreground">Mục này chưa có câu ví dụ.</p>
        </TapToHear>
      )}

      {card.mode === 'cloze' && (
        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Chọn đáp án">
          {card.choices.map((choice, i) => {
            const isAnswer = choice.itemId === card.itemId;
            const isPicked = choice.itemId === picked;
            return (
              <button
                key={choice.itemId}
                type="button"
                disabled={answered}
                onClick={() => onPick(choice.itemId)}
                // A Duolingo answer tile: a thick bottom edge that a press sinks into (the margin
                // takes the 2px it loses, so nothing below moves); once answered, the right one
                // turns green, a wrong pick red, and the rest step back.
                className={cn(
                  'relative flex min-h-16 items-center justify-center rounded-xl border-2 border-b-4 px-12 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  !answered &&
                    'border-control-edge bg-card hover:bg-muted active:mt-0.5 active:border-b-2',
                  answered && isAnswer && 'border-ok bg-ok-wash text-ok',
                  answered &&
                    isPicked &&
                    !isAnswer &&
                    'border-destructive bg-alert-wash text-destructive',
                  answered && !isAnswer && !isPicked && 'border-control-edge bg-card opacity-50',
                )}
              >
                <span className="absolute left-3 flex size-7 items-center justify-center rounded-md border-2 border-current/20 text-xs font-semibold opacity-80">
                  {i + 1}
                </span>
                <span lang="ja" className="text-lg font-semibold">
                  {choice.expression}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {answered && (
        <div className="space-y-3 rounded-lg border-2 border-border bg-card p-5 shadow-lift-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <SpokenLine
              text={heading}
              speakText={card.reading ?? card.expression}
              ruby={heading === card.expression ? ruby : null}
              showFurigana={showFurigana}
              speaker={tts.voiceSpeaker}
              rate={tts.speechRate}
              label="Nghe"
              className="text-2xl font-bold"
            />
            {card.hanviet && (
              <span className="text-base font-semibold text-muted-foreground uppercase">
                <span className="sr-only">Âm Hán Việt: </span>[{card.hanviet}]
              </span>
            )}
          </div>
          <p className="text-lg font-semibold">{card.meaningVi}</p>
          {/* Only here, never on the question: the translation would give the answer away. */}
          {card.sentence?.translation && (
            <p>
              <span className="font-semibold">Dịch câu</span> {card.sentence.translation}
            </p>
          )}
          {card.structure && (
            <p>
              <span className="font-semibold">Cấu trúc</span>{' '}
              <span lang="ja">{card.structure}</span>
            </p>
          )}
          {card.note && (
            <p className="rounded-sm bg-warn-wash px-3 py-2">
              <span className="font-semibold">Lưu ý</span> {card.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
