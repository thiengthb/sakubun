import Link from 'next/link';
import { Check, MessagesSquare, UserRound } from 'lucide-react';
import { LIST_CARD } from '@/components/common/list-card';
import { LikeButton } from '@/components/features/library/like-button';
import { cn } from '@/lib/core/utils';
import { Truncate } from '@/components/ui/truncate';

export interface LibraryScriptRow {
  id: string;
  title: string;
  /** The first spoken line, without its readings. */
  firstLine: string;
  speakers: string[];
  lineCount: number;
  // The learner who shared it; null once that account is gone.
  author: string | null;
  takeCount: number;
  likes: number;
  liked: boolean;
  // The learner's own script: the copy they took, or the one they shared it from.
  myScriptId: string | null;
}

/** "2 vai · 12 câu", or "Độc thoại · 5 câu". */
export const scriptSize = (row: Pick<LibraryScriptRow, 'speakers' | 'lineCount'>) =>
  `${row.speakers.length > 1 ? `${row.speakers.length} vai` : 'Độc thoại'} · ${row.lineCount} câu`;

// A Kaiwa script a learner shared on Kho chung (K7), drawn like a shared group: title and first line
// one line each, who shared it, its size and takes, then the likes. Opens its page, where it is
// read and taken.
export function LibraryScriptCard({ script }: { script: LibraryScriptRow }) {
  return (
    <li
      data-slot="library-script"
      className={cn(LIST_CARD.base, LIST_CARD.linked, 'flex min-w-0 flex-col gap-1')}
    >
      <Link href={`/library/script/${script.id}`} className={LIST_CARD.link}>
        <span className="sr-only">Mở {script.title}</span>
      </Link>

      <div className="flex items-center gap-2">
        <MessagesSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Truncate className="flex-1 font-medium">{script.title}</Truncate>
        {script.myScriptId && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ok">
            <Check className="size-4" aria-hidden />
            Đã có
          </span>
        )}
      </div>

      <Truncate className="text-sm text-muted-foreground">
        <span lang="ja">{script.firstLine}</span>
      </Truncate>

      <div className="mt-auto flex min-w-0 items-center gap-2 pt-1 text-xs text-muted-foreground">
        <span className="shrink-0">{scriptSize(script)}</span>
        <span aria-hidden>·</span>
        <span className="flex min-w-0 items-center gap-1">
          <UserRound className="size-4 shrink-0" aria-hidden />
          <Truncate>{script.author ?? 'Người dùng đã xoá'}</Truncate>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {script.takeCount > 0 && <span>{script.takeCount} lượt lấy</span>}
          <LikeButton
            entryId={script.id}
            liked={script.liked}
            likes={script.likes}
            name={script.title}
          />
        </span>
      </div>
    </li>
  );
}
