import Link from 'next/link';
import { Check } from 'lucide-react';
import { LIST_CARD } from '@/components/common/list-card';
import { GroupKindBadge } from '@/components/common/group-kind-badge';
import { ORIGIN_LABEL } from '@/components/features/library/library-entry-card';
import { LikeButton } from '@/components/features/library/like-button';
import { isGroupKind } from '@/lib/library/group-kinds';
import { cn } from '@/lib/core/utils';
import { Truncate } from '@/components/ui/truncate';

export interface LibraryGroupRow {
  id: string;
  name: string | null;
  groupKind: string | null;
  notes: string | null;
  origin: string;
  takeCount: number;
  size: number;
  likes: number;
  liked: boolean;
  // The learner's own group taken from this one, when they took it.
  myGroupId: string | null;
}

// A shared group on Kho chung: opens its page, where it is taken whole.
export function LibraryGroupCard({ group }: { group: LibraryGroupRow }) {
  return (
    <li className={cn(LIST_CARD.base, LIST_CARD.linked, 'min-w-0 space-y-1.5')}>
      <Link
        href={`/library/${group.id}`}
        className={LIST_CARD.link}
        aria-label={`Mở ${group.name}`}
      />
      <div className="flex items-center gap-2">
        {group.groupKind && isGroupKind(group.groupKind) && (
          <GroupKindBadge kind={group.groupKind} />
        )}
        <span className="min-w-0 truncate font-bold">{group.name}</span>
      </div>
      {group.notes && <Truncate className="text-sm text-muted-foreground">{group.notes}</Truncate>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{group.size} mục</span>
        <span aria-hidden>·</span>
        <span>{ORIGIN_LABEL[group.origin] ?? group.origin}</span>
        {group.takeCount > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{group.takeCount} lượt lấy</span>
          </>
        )}
        {group.myGroupId && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 text-foreground">
              <Check className="size-4" aria-hidden />
              Đã lấy
            </span>
          </>
        )}
        <span className="ml-auto">
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
