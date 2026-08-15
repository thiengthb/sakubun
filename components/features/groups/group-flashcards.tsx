'use client';

import { useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  CardDeck,
  DeckCommonSettings,
  DeckDone,
  DeckShortcutsInfo,
  useAutoSpeak,
  useDeckOrder,
} from '@/components/common/card-deck';
import { SpokenLine } from '@/components/common/spoken-line';
import { ItemDetailDialog } from '@/components/common/item-detail-dialog';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';
import { speakable } from '@/lib/core/format';
import { parseEnrichment } from '@/lib/library/enrichment';
import type { GroupMemberItem } from '@/lib/library/groups';

interface TtsProps {
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}

const detailKind = (kind: string): 'grammar' | 'vocab' => (kind === 'VOCAB' ? 'vocab' : 'grammar');
const memberKey = (m: GroupMemberItem) => m.itemId;

type Direction = 'ja-vi' | 'vi-ja';

function TermFace({
  item,
  tts,
  playToken,
}: {
  item: GroupMemberItem;
  tts: TtsProps;
  playToken?: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <SpokenLine
        text={item.expression}
        speakText={speakable(item.expression)}
        ruby={buildFuriganaMarkup(item.expression, item.reading)}
        showFurigana={tts.showFurigana}
        speaker={tts.voiceSpeaker}
        rate={tts.speechRate}
        label="Nghe"
        className="text-4xl leading-tight font-semibold sm:text-5xl"
        playToken={playToken}
      />
    </div>
  );
}

function MeaningPromptFace({ item }: { item: GroupMemberItem }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 text-center">
      <span className="text-3xl leading-snug font-semibold sm:text-4xl">
        {item.meaningVi || <span className="text-muted-foreground">(chưa có nghĩa)</span>}
      </span>
      {item.hanviet && (
        <span className="text-sm text-muted-foreground">Hán Việt: {item.hanviet}</span>
      )}
    </div>
  );
}

function DetailFace({
  item,
  tts,
  playToken,
}: {
  item: GroupMemberItem;
  tts: TtsProps;
  playToken?: string | null;
}) {
  const enrichment = detailKind(item.kind) === 'grammar' ? parseEnrichment(item.enrichment) : null;
  const examples = enrichment ? [enrichment.example, ...enrichment.examples] : [];
  return (
    <div className="flex w-full flex-col gap-3 text-left">
      <span className="block text-xs tracking-wide text-muted-foreground uppercase">Đáp án</span>

      <div>
        <SpokenLine
          text={item.expression}
          speakText={speakable(item.expression)}
          ruby={buildFuriganaMarkup(item.expression, item.reading)}
          showFurigana={tts.showFurigana}
          speaker={tts.voiceSpeaker}
          rate={tts.speechRate}
          label="Nghe"
          className="text-2xl font-semibold sm:text-3xl"
          playToken={playToken}
        />
      </div>

      <div className="space-y-0.5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Nghĩa</p>
        <p className="font-medium">
          {item.meaningVi || <span className="text-muted-foreground">(chưa có nghĩa)</span>}
          {item.hanviet && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">· {item.hanviet}</span>
          )}
        </p>
      </div>

      {enrichment?.usage && (
        <div className="space-y-0.5">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Cách dùng</p>
          <p className="text-sm">{enrichment.usage}</p>
        </div>
      )}

      {examples.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Ví dụ</p>
          <ul className="space-y-2">
            {examples.map((ex, i) => (
              <li key={`${ex.ja}-${i}`} className="space-y-0.5">
                <SpokenLine
                  text={ex.ja}
                  ruby={ex.jaRuby}
                  showFurigana={tts.showFurigana}
                  speaker={tts.voiceSpeaker}
                  rate={tts.speechRate}
                  label="Nghe ví dụ"
                />
                <p className="text-sm text-muted-foreground">{ex.vi}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!enrichment && item.notes && (
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Ví dụ</p>
          <SpokenLine
            text={item.notes}
            showFurigana={tts.showFurigana}
            speaker={tts.voiceSpeaker}
            rate={tts.speechRate}
            label="Nghe ví dụ"
          />
        </div>
      )}
    </div>
  );
}

export function GroupFlashcards({
  members,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  members: GroupMemberItem[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const tts: TtsProps = { voiceSpeaker, speechRate, showFurigana };
  const [direction, setDirection] = useState<Direction>('ja-vi');
  const [autoSpeak, setAutoSpeak] = useAutoSpeak();
  const order = useDeckOrder(members, memberKey);
  const { cards, deck } = order;
  const current = cards[deck.index];

  const setDir = useCallback(
    (d: Direction) => {
      setDirection(d);
      if (deck.flipped) deck.flip();
    },
    [deck],
  );

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-14 text-center ring-1 ring-foreground/10">
        <Sparkles className="size-6 text-primary" />
        <p className="font-medium">Chưa có thẻ nào để học</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sang tab <b>Danh sách</b> và thêm mục vào nhóm, rồi quay lại đây để học flashcard.
        </p>
      </div>
    );
  }

  const dirLabel = direction === 'ja-vi' ? 'Nhật → Việt' : 'Việt → Nhật';

  const frontToken =
    autoSpeak && current && direction === 'ja-vi' && !deck.flipped
      ? `${current.itemId}:term`
      : null;
  const answerToken =
    autoSpeak && current && direction === 'vi-ja' && deck.flipped
      ? `${current.itemId}:answer`
      : null;

  return (
    <CardDeck
      deck={deck}
      cardKey={current?.itemId ?? 'done'}
      toolbar={
        <DeckCommonSettings
          order={order}
          autoSpeak={autoSpeak}
          onAutoSpeakChange={setAutoSpeak}
          autoSpeakHint={
            direction === 'ja-vi'
              ? 'Đọc mẫu/từ ngay khi thẻ hiện ra.'
              : 'Đọc phần tiếng Nhật đầu của đáp án sau khi lật. Ví dụ thì không tự đọc.'
          }
        >
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Chiều thẻ · đang: <span className="text-foreground">{dirLabel}</span>
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setDir('ja-vi')}
                className={
                  direction === 'ja-vi'
                    ? 'rounded-md bg-card px-2 py-1.5 text-sm font-medium text-foreground shadow-sm'
                    : 'rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
                }
              >
                Nhật → Việt
              </button>
              <button
                type="button"
                onClick={() => setDir('vi-ja')}
                className={
                  direction === 'vi-ja'
                    ? 'rounded-md bg-card px-2 py-1.5 text-sm font-medium text-foreground shadow-sm'
                    : 'rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
                }
              >
                Việt → Nhật
              </button>
            </div>
          </div>
        </DeckCommonSettings>
      }
      front={
        current && (
          <>
            <span className="absolute top-3 left-4 text-xs tracking-wide text-muted-foreground uppercase">
              {direction === 'ja-vi' ? 'Tiếng Nhật' : 'Tiếng Việt'}
            </span>
            {direction === 'ja-vi' ? (
              <TermFace item={current} tts={tts} playToken={frontToken} />
            ) : (
              <MeaningPromptFace item={current} />
            )}
          </>
        )
      }
      back={current && <DetailFace item={current} tts={tts} playToken={answerToken} />}
      corner={
        current && (
          <>
            <ItemDetailDialog
              item={{
                expression: current.expression,
                reading: current.reading,
                hanviet: current.hanviet,
                meaningVi: current.meaningVi ?? '',
                notes: current.notes ?? null,
                level: current.level,
                enrichment: current.enrichment,
                suspended: current.suspended ?? false,
                srs: current.srs ?? null,
              }}
              kind={detailKind(current.kind)}
              triggerVariant="icon"
              detailHref={`/resources/${current.itemId}`}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
            />
            <DeckShortcutsInfo />
          </>
        )
      }
      done={
        <DeckDone
          icon={Sparkles}
          count={cards.length}
          unit="thẻ"
          hint="Vuốt sang phải hoặc bấm mũi tên trái để xem lại thẻ vừa rồi."
          onReplay={order.replay}
        />
      }
    />
  );
}
