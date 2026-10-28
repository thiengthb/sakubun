'use client';

import type { KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Truncate } from '@/components/ui/truncate';
import { LIST_CARD } from '@/components/common/list-card';
import { SpokenLine } from '@/components/common/spoken-line';
import {
  PendingPill,
  ResultPill,
  dirLabel,
  exerciseTypeChip,
} from '@/components/features/history/history-shared';
import { timeOfDay } from '@/lib/history/days';
import { historyResult } from '@/lib/history/result';
import type { HistoryRow } from '@/lib/app/history';
import { cn } from '@/lib/core/utils';

// One turn on the timeline (thien, 7.4 History B): two lines, the prompt and then what the learner
// wrote, so a glance shows which turn went astray. On a laptop the time and the chips lead the row;
// on a phone they drop under the two lines. The result stands on the right at every width. A click
// opens the turn in the side panel; a waiting turn has nothing to open yet.

function Prompt({
  sentence,
  showFurigana,
  speaker,
  rate,
}: {
  sentence: HistoryRow;
  showFurigana: boolean;
  speaker?: number;
  rate?: number;
}) {
  if (sentence.direction !== 'JA_VI') {
    return <Truncate className="text-sm font-medium">{sentence.sourceText}</Truncate>;
  }
  return (
    <SpokenLine
      lookup="hover"
      text={sentence.sourceText}
      ruby={sentence.sourceRuby}
      showFurigana={showFurigana}
      speaker={speaker}
      rate={rate}
      label="Nghe đề"
      truncate
      speakerEnd
      className="text-sm"
    />
  );
}

function Answer({
  sentence,
  speaker,
  rate,
}: {
  sentence: HistoryRow;
  speaker?: number;
  rate?: number;
}) {
  if (sentence.status === 'PENDING') {
    return <span className="text-xs text-muted-foreground">Chưa trả lời</span>;
  }
  if (!sentence.userAnswer) return null;
  return (
    <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      <span className="shrink-0">Bạn:</span>
      {sentence.direction === 'VI_JA' ? (
        <SpokenLine
          lookup="hover"
          text={sentence.userAnswer}
          speaker={speaker}
          rate={rate}
          label="Nghe câu bạn viết"
          truncate
          speakerEnd
          className="font-normal"
        />
      ) : (
        <Truncate>{sentence.userAnswer}</Truncate>
      )}
    </span>
  );
}

export function HistoryTimelineRow({
  sentence,
  selected,
  showFurigana,
  speaker,
  rate,
  onOpen,
}: {
  sentence: HistoryRow;
  selected: boolean;
  showFurigana: boolean;
  speaker?: number;
  rate?: number;
  onOpen: () => void;
}) {
  const pending = sentence.status === 'PENDING';
  const type = exerciseTypeChip(sentence.exerciseType);
  const open = pending
    ? {}
    : {
        role: 'button',
        tabIndex: 0,
        'aria-haspopup': 'dialog' as const,
        'aria-current': selected || undefined,
        onClick: onOpen,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        },
      };
  return (
    <div
      data-history-row={sentence.id}
      {...open}
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3.5 py-2 text-left md:grid-cols-[2.75rem_auto_minmax(0,1fr)_auto]',
        !pending &&
          'cursor-pointer hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        selected && LIST_CARD.chosen,
      )}
    >
      <span className="col-start-1 row-start-2 flex min-w-0 items-center gap-2 md:contents">
        <span className="text-xs text-muted-foreground tabular-nums md:col-start-1 md:row-start-1">
          {timeOfDay(sentence.createdAt)}
        </span>
        <span className="flex items-center gap-1 md:col-start-2 md:row-start-1">
          <Badge variant="secondary">{dirLabel(sentence.direction)}</Badge>
          {sentence.level && <Badge variant="outline">{sentence.level}</Badge>}
          {type && <Badge variant="outline">{type}</Badge>}
        </span>
      </span>
      <span className="col-start-1 row-start-1 flex min-w-0 flex-col md:col-start-3">
        <Prompt sentence={sentence} showFurigana={showFurigana} speaker={speaker} rate={rate} />
        <Answer sentence={sentence} speaker={speaker} rate={rate} />
      </span>
      <span className="col-start-2 row-span-2 row-start-1 flex justify-end md:col-start-4 md:row-span-1">
        {pending ? <PendingPill /> : <ResultPill result={historyResult(sentence)} />}
      </span>
    </div>
  );
}
