'use client';

import Link from 'next/link';
import { BookCheck, Download } from 'lucide-react';
import { CardAction } from '@/components/common/card-action';
import { LIST_CARD } from '@/components/common/list-card';
import { ResourceCard } from '@/components/common/resource-card';
import { useServerAction } from '@/components/common/use-server-action';
import { takeEntryAction } from '@/app/library/actions';
import { LikeButton } from '@/components/features/library/like-button';
import { speakable } from '@/lib/core/format';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';
import { splitPatternLabel } from '@/lib/library/pattern-label';
import { cn } from '@/lib/core/utils';

export interface LibraryEntryRow {
  id: string;
  type: string;
  expression: string | null;
  reading: string | null;
  meaningVi: string | null;
  level: string | null;
  origin: string;
  takeCount: number;
  likes: number;
  liked: boolean;
  // The learner's own copy, when they have one (same kind and expression).
  itemId: string | null;
}

export const ORIGIN_LABEL: Record<string, string> = { OPENJLPT: 'OpenJLPT', LEARNER: 'Cộng đồng' };

// One pattern or word on Kho chung, shaped like the learner's own cards (ResourceCard, 7.4i): the
// level chip on the left, the line and its speaker (the pattern's note in Vietnamese after it), the meaning and where it comes from; on the
// right "Lấy về kho" (or a tick to the learner's copy) and the likes. The card opens the entry's own
// page, which is also where the admin hides it.
export function LibraryEntryCard({
  entry,
  showFurigana,
  voiceSpeaker,
  speechRate,
}: {
  entry: LibraryEntryRow;
  showFurigana: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
}) {
  const take = useServerAction(takeEntryAction, {
    success: (r) => (r.already ? 'Đã có trong kho' : `Đã lấy ${entry.expression} về kho`),
  });
  const expression = entry.expression ?? '';
  // OpenJLPT's English note on a pattern, 〜が（subject）, becomes a small Vietnamese one after it.
  const { pattern, label } =
    entry.type === 'GRAMMAR' ? splitPatternLabel(expression) : { pattern: expression, label: null };
  return (
    <li data-slot="library-entry" className={cn(LIST_CARD.base, LIST_CARD.linked, 'min-w-0')}>
      <Link
        href={`/library/item/${entry.id}`}
        aria-label={`Xem ${expression}`}
        className={LIST_CARD.link}
      />
      <ResourceCard
        expression={pattern}
        ruby={buildFuriganaMarkup(pattern, entry.reading)}
        speakText={speakable(pattern)}
        extra={label && <span className="ml-1.5 text-xs text-muted-foreground">{label}</span>}
        meaningVi={entry.meaningVi ?? ''}
        level={entry.level ?? ''}
        showFurigana={showFurigana}
        voiceSpeaker={voiceSpeaker}
        speechRate={speechRate}
        aside={
          <span className="shrink-0 text-xs">{ORIGIN_LABEL[entry.origin] ?? entry.origin}</span>
        }
        actions={
          entry.itemId ? (
            <CardAction
              icon={BookCheck}
              label="Đã có trong kho"
              href={`/resources/${entry.itemId}`}
              className="relative z-10 text-ok hover:text-ok"
            />
          ) : (
            <CardAction
              icon={Download}
              label={`Lấy ${expression} về kho`}
              onClick={() => take.run(entry.id)}
              disabled={take.isPending}
            />
          )
        }
        star={
          <LikeButton
            entryId={entry.id}
            liked={entry.liked}
            likes={entry.likes}
            name={expression}
          />
        }
      />
    </li>
  );
}
