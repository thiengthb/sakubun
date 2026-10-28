'use client';

import Link from 'next/link';
import { Check, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LIST_CARD } from '@/components/common/list-card';
import { SpokenLine } from '@/components/common/spoken-line';
import { useServerAction } from '@/components/common/use-server-action';
import { takeEntryAction } from '@/app/library/actions';
import { LikeButton } from '@/components/features/library/like-button';
import { RemoveEntryButton } from '@/components/common/remove-entry-button';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';
import { cn } from '@/lib/core/utils';
import { Truncate } from '@/components/ui/truncate';

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
const TYPE_LABEL: Record<string, string> = { GRAMMAR: 'Ngữ pháp', VOCAB: 'Từ vựng' };

// One pattern or word on Kho chung: playable like every Japanese line, its meaning, where it comes
// from, and "Lấy" (or "Đã có", to the learner's copy).
export function LibraryEntryCard({
  entry,
  admin = false,
  showFurigana,
  voiceSpeaker,
  speechRate,
}: {
  entry: LibraryEntryRow;
  /** The admin's Ẩn (L6). */
  admin?: boolean;
  showFurigana: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
}) {
  const take = useServerAction(takeEntryAction, {
    success: (r) => (r.already ? 'Đã có trong kho' : `Đã lấy ${entry.expression} về kho`),
  });
  const expression = entry.expression ?? '';
  return (
    <li data-slot="library-entry" className={cn(LIST_CARD.base, 'min-w-0 space-y-1.5')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <SpokenLine
            text={expression}
            ruby={buildFuriganaMarkup(expression, entry.reading)}
            showFurigana={showFurigana}
            speaker={voiceSpeaker}
            rate={speechRate}
            label="Nghe mẫu"
          />
        </div>
        {entry.itemId ? (
          <Button variant="ghost" asChild>
            <Link href={`/resources/${entry.itemId}`}>
              <Check aria-hidden />
              Đã có
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => take.run(entry.id)}
            disabled={take.isPending}
            aria-label={`Lấy ${expression} về kho`}
          >
            <Download aria-hidden />
            Lấy
          </Button>
        )}
      </div>
      <Truncate className="text-sm text-muted-foreground">{entry.meaningVi}</Truncate>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{TYPE_LABEL[entry.type] ?? entry.type}</span>
        <span aria-hidden>·</span>
        <Badge variant="outline" className="px-1.5 py-0 text-xs">
          {entry.level}
        </Badge>
        <span aria-hidden>·</span>
        <span>{ORIGIN_LABEL[entry.origin] ?? entry.origin}</span>
        {entry.takeCount > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{entry.takeCount} lượt lấy</span>
          </>
        )}
        <span className="ml-auto flex items-center gap-1">
          {admin && <RemoveEntryButton entryId={entry.id} name={expression} />}
          <LikeButton
            entryId={entry.id}
            liked={entry.liked}
            likes={entry.likes}
            name={expression}
          />
        </span>
      </div>
    </li>
  );
}
