import { Badge } from '@/components/ui/badge';
import { SpokenLine } from '@/components/common/spoken-line';
import { LIST_CARD } from '@/components/common/list-card';
import { plainJapanese, type ScriptLine } from '@/lib/kaiwa/parse';
import { cn } from '@/lib/core/utils';

// A script line with the furigana to show: worked out on save, or the author's own (K4).
export type RubyLine = ScriptLine & { ruby: string };

// One line of a script: the speaker's label, the Japanese with its play button and furigana, and
// the Vietnamese under it. The first speaker sits on the left and the
// second is indented, so a dialogue reads as turns; monologue lines span the width.
export function KaiwaLine({
  line,
  side,
  showMeaning,
  showFurigana,
  voiceSpeaker,
  speechRate,
}: {
  line: RubyLine;
  side: number | null;
  showMeaning: boolean;
  showFurigana: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
}) {
  const plain = plainJapanese(line.japanese);
  return (
    <li
      data-slot="kaiwa-line"
      className={cn(LIST_CARD.base, 'flex items-start gap-3', side === 1 && 'md:ml-12')}
    >
      {line.speaker !== null && (
        <Badge
          variant={side === 1 ? 'secondary' : 'outline'}
          aria-label={`Người nói ${line.speaker}`}
          className="mt-0.5 min-w-7"
        >
          {line.speaker}
        </Badge>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <SpokenLine
          text={plain}
          ruby={line.ruby}
          showFurigana={showFurigana}
          speaker={voiceSpeaker}
          rate={speechRate}
          label="Nghe câu"
        />
        {line.translation && showMeaning && (
          <p className="text-sm text-muted-foreground">{line.translation}</p>
        )}
      </div>
    </li>
  );
}
