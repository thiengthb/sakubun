import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LIST_CARD } from '@/components/common/list-card';
import { HaveBar, haveText } from '@/components/features/library/have-bar';
import type { LibraryGroupRow } from '@/components/features/library/library-group-card';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import { JLPT_LEVELS } from '@/lib/settings/schema';
import { cn } from '@/lib/core/utils';

const KINDS = ['grammar', 'vocab'] as const;

// OpenJLPT's level groups as one table (thien, 7.4h): a row per level, a cell per kind with its size
// and how much of it the learner has; a cell opens the group.
export function LibraryLevels({ groups }: { groups: LibraryGroupRow[] }) {
  const at = new Map(groups.map((g) => [`${g.level}:${g.groupKind}`, g]));
  return (
    <div data-slot="library-levels" className={cn(LIST_CARD.base, 'p-0')}>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-14 px-3 md:w-20">Cấp</TableHead>
            {KINDS.map((kind) => (
              <TableHead key={kind} className="px-3">
                {GROUP_KIND_LABELS[kind]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {JLPT_LEVELS.map((level) => (
            <TableRow key={level} className="hover:bg-transparent">
              <TableHead scope="row" className="px-3">
                <Badge variant="outline">{level}</Badge>
              </TableHead>
              {KINDS.map((kind) => {
                const group = at.get(`${level}:${kind}`);
                return (
                  <TableCell key={kind} className="p-0">
                    {group && <LevelCell group={group} />}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LevelCell({ group }: { group: LibraryGroupRow }) {
  const have = haveText(group.have, group.size);
  return (
    <Link
      href={`/library/${group.id}`}
      aria-label={`Mở ${group.name}: ${group.size} mục, ${have.toLowerCase()}`}
      className="block space-y-1.5 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="font-medium tabular-nums">{group.size} mục</span>
        <span
          className={cn(
            'truncate text-xs tabular-nums',
            group.have >= group.size && group.size > 0 ? 'text-ok' : 'text-muted-foreground',
          )}
        >
          {group.have > 0 && group.have < group.size ? `Đã có ${group.have}` : have}
        </span>
      </span>
      <HaveBar have={group.have} size={group.size} label={group.name ?? ''} />
    </Link>
  );
}
