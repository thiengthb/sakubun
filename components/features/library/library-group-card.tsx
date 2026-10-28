import Link from 'next/link';
import { Check, Layers, UserRound } from 'lucide-react';
import { LIST_CARD } from '@/components/common/list-card';
import { GroupKindBadge } from '@/components/common/group-kind-badge';
import { LikeButton } from '@/components/features/library/like-button';
import { isGroupKind } from '@/lib/library/group-kinds';
import { cn } from '@/lib/core/utils';
import { Truncate } from '@/components/ui/truncate';

export interface LibraryGroupRow {
  id: string;
  name: string | null;
  groupKind: string | null;
  level: string | null;
  notes: string | null;
  origin: string;
  // The learner who shared it; null for OpenJLPT's, or once that account is gone.
  author: string | null;
  takeCount: number;
  size: number;
  // How many of its entries the learner has already.
  have: number;
  likes: number;
  liked: boolean;
  // The learner's own group taken from this one, when they took it.
  myGroupId: string | null;
}

// A group a learner shared on Kho chung (7.4h): name and note one line each, who shared it, its size
// and takes, then the likes. Opens its page, where it is taken whole.
export function LibraryGroupCard({ group }: { group: LibraryGroupRow }) {
  return (
    <li
      data-slot="library-group"
      className={cn(LIST_CARD.base, LIST_CARD.linked, 'flex min-w-0 flex-col gap-1')}
    >
      <Link href={`/library/${group.id}`} className={LIST_CARD.link}>
        <span className="sr-only">Mở {group.name}</span>
      </Link>

      <div className="flex items-center gap-2">
        <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Truncate className="flex-1 font-medium">{group.name}</Truncate>
        {group.myGroupId && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ok">
            <Check className="size-4" aria-hidden />
            Đã lấy
          </span>
        )}
      </div>

      <Truncate
        className={cn('text-sm text-muted-foreground', !group.notes && 'text-muted-foreground/70')}
      >
        {group.notes || 'Chưa có ghi chú'}
      </Truncate>

      <div className="mt-auto flex min-w-0 items-center gap-2 pt-1 text-xs text-muted-foreground">
        {group.groupKind && isGroupKind(group.groupKind) && (
          <GroupKindBadge kind={group.groupKind} />
        )}
        <span className="shrink-0">{group.size} mục</span>
        <span aria-hidden>·</span>
        <span className="flex min-w-0 items-center gap-1">
          <UserRound className="size-4 shrink-0" aria-hidden />
          <Truncate>{group.author ?? 'Người dùng đã xoá'}</Truncate>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {group.takeCount > 0 && <span>{group.takeCount} lượt lấy</span>}
          <LikeButton
            entryId={group.id}
            liked={group.liked}
            likes={group.likes}
            name={group.name ?? ''}
          />
        </span>
      </div>
    </li>
  );
}
