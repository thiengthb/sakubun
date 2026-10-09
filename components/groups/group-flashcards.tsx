'use client';

import { useCallback, useMemo, useState } from 'react';
import { Volume2, Shuffle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CardDeck,
  DeckSettings,
  DeckShortcutsInfo,
  DeckSwitchRow,
  shuffled,
  useCardDeck,
} from '@/components/shared/card-deck';
import { SpokenLine } from '@/components/shared/spoken-line';
import { ItemDetailDialog } from '@/components/resources/item-detail-dialog';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { useSessionState } from '@/components/shared/use-session-state';
import { speakable } from '@/lib/format';
import { parseEnrichment } from '@/lib/enrichment';
import type { GroupMemberItem } from '@/lib/groups';

interface TtsProps {
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}

const detailKind = (kind: string): 'grammar' | 'vocab' => (kind === 'VOCAB' ? 'vocab' : 'grammar');

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
  const [shuffle, setShuffle] = useState(false);
  const membersOrder = useMemo(() => members.map((m) => m.itemId), [members]);
  const [order, setOrder] = useState<string[]>(membersOrder);

  const [autoSpeak, setAutoSpeak] = useSessionState('flashcards.autoSpeak', false);

  const byId = useMemo(() => new Map(members.map((m) => [m.itemId, m])), [members]);
  const cards = useMemo(
    () => order.map((id) => byId.get(id)).filter((m) => m != null),
    [order, byId],
  );
  const deck = useCardDeck(cards.length);
  const current = cards[deck.index];

  const toggleShuffle = useCallback(() => {
    const next = !shuffle;
    setShuffle(next);
    setOrder(next ? shuffled(membersOrder) : membersOrder);
    deck.restart();
  }, [shuffle, membersOrder, deck]);

  const replay = useCallback(
    (reshuffle: boolean) => {
      if (reshuffle) setOrder(shuffled(membersOrder));
      deck.restart();
    },
    [membersOrder, deck],
  );

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
        <DeckSettings>
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
          <DeckSwitchRow
            icon={Shuffle}
            label="Trộn thẻ"
            checked={shuffle}
            onCheckedChange={toggleShuffle}
            disabled={members.length < 2}
          />
          <DeckSwitchRow
            icon={Volume2}
            label="Tự đọc tiếng Nhật"
            hint={
              direction === 'ja-vi'
                ? 'Đọc mẫu/từ ngay khi thẻ hiện ra.'
                : 'Đọc phần tiếng Nhật đầu của đáp án sau khi lật. Ví dụ thì không tự đọc.'
            }
            checked={autoSpeak}
            onCheckedChange={setAutoSpeak}
          />
        </DeckSettings>
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
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
          <Sparkles className="size-8 text-primary" />
          <div className="space-y-1">
            <p className="text-lg font-semibold">Đã lướt hết {cards.length} thẻ</p>
            <p className="text-sm text-muted-foreground">
              Vuốt sang phải hoặc bấm mũi tên trái để xem lại thẻ vừa rồi.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => replay(false)}>Học lại từ đầu</Button>
            {cards.length > 1 && (
              <Button variant="outline" onClick={() => replay(true)}>
                Trộn rồi học lại
              </Button>
            )}
          </div>
        </div>
      }
    />
  );
}
