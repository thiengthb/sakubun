'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { SpokenLine } from '@/components/common/spoken-line';
import { cn } from '@/lib/core/utils';
import { Truncate } from '@/components/ui/truncate';

// A grammar pattern or a word in a card list (thien, 7.4 B1): the level chip in a narrow left
// column across both lines, the title with a small pale speaker right after it, the meaning under
// it; the menu and the star stand in the right column. An item never reviewed wears a red "Mới"
// tag on the top edge. No status line: the table view has the schedule.
export function ResourceCard({
  expression,
  ruby,
  speakText,
  meaningVi,
  level,
  suspended,
  srs,
  showFurigana,
  voiceSpeaker,
  speechRate,
  aside,
  extra,
  actions,
  star,
}: {
  expression: string;
  ruby: string | null;
  speakText: string;
  meaningVi: string;
  level: string;
  suspended: boolean;
  srs: { state: number } | null;
  showFurigana: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  /** After the meaning, on its line: a small badge (why a word was caught, its kind). */
  aside?: ReactNode;
  /** After the title, on its line: the Hán Việt reading. */
  extra?: ReactNode;
  /** The top right corner: the item's menu, or the one action the list offers. */
  actions: ReactNode;
  /** Under the menu. */
  star?: ReactNode;
}) {
  const fresh = !suspended && (srs?.state ?? 0) === 0;
  return (
    <div
      data-slot="resource-card"
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5',
        suspended && 'opacity-60',
      )}
    >
      {/* Positioned by the card around it (LIST_CARD), centred on its top border. */}
      {fresh && (
        <span className="pointer-events-none absolute -top-2.5 right-3.5 z-10 rounded-sm bg-destructive px-1.5 py-0.5 text-xs leading-none font-semibold text-destructive-foreground">
          Mới
        </span>
      )}
      <Badge variant="outline" className="row-span-2 px-1.5">
        {level}
      </Badge>
      <SpokenLine
        text={expression}
        speakText={speakText}
        ruby={ruby}
        showFurigana={showFurigana}
        speaker={voiceSpeaker}
        rate={speechRate}
        label="Nghe mẫu"
        truncate
        speakerEnd
        aside={extra}
      />
      <div className="flex items-center justify-end gap-0.5">{actions}</div>
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Truncate className="min-w-0">{meaningVi}</Truncate>
        {suspended && (
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            Tạm ngưng
          </Badge>
        )}
        {aside}
      </div>
      <div className="flex items-center justify-end">{star}</div>
    </div>
  );
}
