'use client';

import { Check, X } from 'lucide-react';
import { SpeakButton } from '@/components/common/speak-button';
import { SpokenLine } from '@/components/common/spoken-line';
import type { QuickCard } from '@/lib/app/quick-review';
import type { Segment } from '@/lib/domain/sentence';
import { cn } from '@/lib/core/utils';
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

function Sentence({
  segments,
  fill,
  showFurigana,
}: {
  segments: Segment[];
  fill: string | null;
  showFurigana: boolean;
}) {
  return (
    <p lang="ja" className="furigana text-2xl leading-[2.2] font-medium sm:text-3xl">
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
              className="mx-1 inline-block h-[1.15em] w-16 border-b-2 border-foreground align-[-0.2em]"
            >
              {'​'}
            </span>
          );
        }
        const target =
          s.mark === 'target' &&
          'font-semibold text-accent-brand underline decoration-2 underline-offset-[6px]';
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

function spokenText(segments: Segment[], fill: string): string {
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
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">
          {card.kind === 'VOCAB' ? 'Từ vựng' : 'Ngữ pháp'} · {card.level}
          {card.isNew && ' · mới'}
        </p>
        <p className="text-lg font-semibold">{QUESTION[card.mode][card.kind]}</p>
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
        <div className="flex justify-center rounded-2xl border bg-card px-4 py-8 text-center">
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
                className={cn(
                  'flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left transition-colors',
                  !answered && 'hover:border-foreground',
                  answered && isAnswer && 'border-ok bg-ok/10 text-ok',
                  answered &&
                    isPicked &&
                    !isAnswer &&
                    'border-destructive bg-destructive/10 text-destructive',
                  answered && !isAnswer && !isPicked && 'opacity-50',
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
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
        <div className="space-y-2.5 rounded-2xl border bg-card p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
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
            <p className="rounded-xl bg-warn/10 px-3 py-2">
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
