'use client';

import { Badge } from '@/components/ui/badge';
import { KanjiStrokes } from '@/components/common/kanji-strokes';
import { KanjiWritePad } from '@/components/common/kanji-write-pad';
import { SpokenLine } from '@/components/common/spoken-line';
import type { QuickCard } from '@/lib/app/quick-review';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';
import { rateHandwriting } from '@/lib/japanese/strokes';
import type { RatingValue } from '@/lib/srs/srs';

// A kanji card of Ôn nhanh (KJ3, docs/plans/2026-11-08-kanji.md › Học một chữ): the glyph alone in
// front; recalling its Hán Việt and meaning is the test, graded with the four FSRS ratings. The back
// gives the readings for reference only (they are learnt through words), the radical, the parts and
// the learner's words written with it, each with a speaker. A new kanji is met with the back open.
// A write card (KJ4) asks for the glyph from its Hán Việt, meaning and a word with it left blank; the
// pad grades each stroke and suggests the rating, which the learner can still change.

type KanjiCard = Extract<QuickCard, { mode: 'kanji' }>;

const RATING_WORD: Record<RatingValue, string> = { 1: 'Quên', 2: 'Khó', 3: 'Nhớ', 4: 'Dễ' };

export function KanjiReviewCard({
  card,
  intro,
  revealed,
  showFurigana,
  tts,
  suggested = null,
  onWritten,
}: {
  card: KanjiCard;
  intro: boolean;
  revealed: boolean;
  showFurigana: boolean;
  tts: { voiceSpeaker?: number; speechRate?: number };
  /** The rating the pad gave, shown on the back of a write card. */
  suggested?: RatingValue | null;
  /** A write card is done (written or given up): the pad's rating. */
  onWritten?: (rating: RatingValue) => void;
}) {
  const answered = revealed || intro;
  const { face } = card;
  const write = face.prompt === 'write' && !intro;
  const rows = [
    { label: 'Âm On', value: face.on.join('、'), ja: true },
    { label: 'Âm Kun', value: face.kun.join('、'), ja: true },
    { label: 'Bộ', value: `${face.radical.radical} ${face.radical.nameVi}`.trim(), ja: false },
    { label: 'Thành phần', value: face.parts.join(' + '), ja: true },
    { label: 'Số nét', value: String(face.strokes), ja: false },
  ].filter((r) => r.value);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">Kanji</Badge>
          {card.level && <Badge variant="outline">{card.level}</Badge>}
          {card.isNew && <Badge variant="secondary">Mới</Badge>}
        </div>
        <p className="text-base font-bold">
          {intro
            ? 'Chữ mới: nhớ âm Hán Việt và nghĩa'
            : write
              ? 'Viết chữ này theo đúng thứ tự nét'
              : 'Chữ này âm Hán Việt là gì, nghĩa là gì?'}
        </p>
      </div>

      {write && !answered ? (
        <div className="flex flex-col items-center gap-4">
          <div className="space-y-1 text-center">
            <p className="text-2xl font-bold">[{card.hanviet}]</p>
            <p className="text-lg font-semibold">{card.meaningVi}</p>
            {face.cue && (
              <p lang="ja" className="text-2xl" data-slot="kanji-cue">
                {face.cue}
              </p>
            )}
          </div>
          <KanjiWritePad
            paths={face.paths}
            onDone={(w) => onWritten?.(rateHandwriting({ ...w, strokes: face.paths.length }))}
          />
        </div>
      ) : answered && face.paths.length > 0 ? (
        // Answered: the glyph is drawn again stroke by stroke, in its order.
        <div className="flex justify-center py-4 md:py-8">
          <KanjiStrokes
            paths={face.paths}
            animate
            label={card.expression}
            className="size-40 md:size-48"
          />
        </div>
      ) : (
        <p
          lang="ja"
          data-slot="kanji-glyph"
          className="py-6 text-center text-8xl leading-none md:py-12"
        >
          {card.expression}
        </p>
      )}

      {answered && (
        <div className="space-y-3 rounded-lg border-2 border-border bg-card p-5 shadow-lift-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          {write && suggested && (
            <p className="text-sm text-muted-foreground" data-slot="kanji-suggested">
              Máy chấm:{' '}
              <span className="font-semibold text-foreground">{RATING_WORD[suggested]}</span>. Chọn
              mức khác bên dưới nếu thấy chưa đúng.
            </p>
          )}
          <p className="text-2xl font-bold">
            <span lang="ja" className="mr-2">
              {card.expression}
            </span>
            <span className="sr-only">Âm Hán Việt: </span>[{card.hanviet}]
          </p>
          <p className="text-lg font-semibold">{card.meaningVi}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd lang={r.ja ? 'ja' : undefined} className="min-w-0 break-words">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
          {face.words.length > 0 && (
            <div className="space-y-1.5 border-t-2 border-border pt-3">
              <p className="text-sm font-semibold">Từ có chữ này</p>
              <ul className="space-y-1.5">
                {face.words.map((w) => (
                  <li
                    key={w.expression}
                    data-slot="kanji-word"
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5"
                  >
                    <SpokenLine
                      text={w.expression}
                      speakText={w.reading ?? w.expression}
                      ruby={buildFuriganaMarkup(w.expression, w.reading)}
                      showFurigana={showFurigana}
                      speaker={tts.voiceSpeaker}
                      rate={tts.speechRate}
                      label={`Nghe ${w.expression}`}
                      className="text-lg font-semibold"
                    />
                    <span className="text-sm text-muted-foreground">{w.meaningVi}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
