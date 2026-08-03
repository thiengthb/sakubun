'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { SpokenLine } from '@/components/shared/spoken-line';
import { DueCell } from '@/components/shared/due-cell';
import { STATE_LABELS } from '@/lib/srs-constants';
import { cn } from '@/lib/utils';

/**
 * One resource item as a CARD — the below-`md` replacement for a row of the grammar / vocab tables
 * (see `DataTable`'s `renderCard`). Both stores share this shell; they differ in exactly two places,
 * so those are slots (`aside` for the vocab capture-reason badge, `extra` for âm Hán Việt) rather than
 * two near-identical components.
 *
 * WHAT IT SHOWS, and why this subset. A table row carries ten columns; a 360px card cannot, and
 * choosing by "what fits" gives a card that is just a truncated row. The rule used here: keep the
 * fields that answer *which item is this* and *do I owe it work today*, and drop the ones you only
 * ever read while diagnosing ONE item — reps, lapses, độ bền, khó FSRS, ngày thêm. Those live a tap
 * away on `/resources/<id>`, which exists precisely to show them.
 *
 * Layout, three bands:
 *   1. the Japanese — the identity of the item, and the only line that gets audio + furigana
 *   2. the Vietnamese meaning — what you actually match against when scanning
 *   3. a meta row: FSRS state · due · level, plus the star and the ⋮ menu at the right edge
 *
 * The JA line is NOT truncated (`truncate` is off): a pattern clipped mid-token is unidentifiable,
 * and wrapping costs one line at most. The meaning IS clamped to two lines — it is prose, and a long
 * gloss would otherwise push the meta row off the fold.
 */
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
  /** Vocab only: the capture-reason badge ("dùng sai", "chưa rõ"…). */
  aside,
  /** Vocab only: âm Hán Việt, shown under the JA line. */
  extra,
  /** The star toggle + the ⋮ row menu — supplied by the table so behaviour stays in one place. */
  actions,
}: {
  expression: string;
  ruby: string | null;
  speakText: string;
  meaningVi: string;
  level: string;
  suspended: boolean;
  srs: { state: number; due: string | Date } | null;
  showFurigana: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  aside?: ReactNode;
  extra?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', suspended && 'opacity-60')}>
      {/* Band 1 — identity. The actions sit on this line so the tap targets are at the top-right,
          where a thumb reaches on a tall list, instead of at the bottom of a variable-height card. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <SpokenLine
            text={expression}
            speakText={speakText}
            ruby={ruby}
            showFurigana={showFurigana}
            speaker={voiceSpeaker}
            rate={speechRate}
            label="Nghe mẫu"
            // A long pattern wraps here (truncate is off), and the default bottom alignment would park
            // the speaker icon beside the LAST line.
            align="start"
          />
          {extra}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      </div>

      {/* Band 2 — meaning. line-clamp-2, not truncate: two lines of a Vietnamese gloss is usually the
          whole gloss, where one line often cuts mid-phrase. */}
      <p className="line-clamp-2 text-sm text-muted-foreground">{meaningVi}</p>

      {/* Band 3 — scheduling meta. Reads left→right as "what state · when · how hard". */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{suspended ? 'Tạm ngưng' : (STATE_LABELS[srs?.state ?? 0] ?? '—')}</span>
        {!suspended && srs != null && srs.state !== 0 && (
          <>
            <span aria-hidden>·</span>
            <DueCell srs={srs} />
          </>
        )}
        <span aria-hidden>·</span>
        <Badge variant="outline" className="px-1.5 py-0 text-xs font-normal">
          {level}
        </Badge>
        {aside}
      </div>
    </div>
  );
}
