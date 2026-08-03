'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { SearchInput } from '@/components/shared/search-input';
import { SearchX } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSessionState } from '@/components/shared/use-session-state';
import { foldVi } from '@/components/guide/guide-topic-meta';
import { MCP_CATALOG } from '@/lib/mcp/catalog';

/**
 * The `/guide` REFERENCE table of MCP tools + prompts, with a filter box — the surface has grown past 30
 * entries, which is exactly where a lookup table stops being scannable ("which tool adds vocab again?").
 * Client-side because the filter is: the rows come from `MCP_CATALOG`, already plain data shared with the
 * server, so nothing extra ships. The query persists like every other view state (`?tool=`).
 *
 * Reuses the app's ONE search box (`SearchInput`) and the ONE empty state, so it reads like the tables on
 * /resources rather than a guide-only invention.
 */
export function GuideToolTable() {
  const [query, setQuery] = useSessionState('guide.tool', '', 'tool');

  const rows = useMemo(() => {
    const q = foldVi(query.trim());
    if (q === '') return MCP_CATALOG;
    const terms = q.split(/\s+/);
    return MCP_CATALOG.filter((entry) => {
      const haystack = foldVi(`${entry.name} ${entry.kind} ${entry.summary}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm tool / prompt…"
          aria-label="Tìm tool hoặc prompt"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {rows.length}/{MCP_CATALOG.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Không có tool nào khớp"
          description="Thử tên tool (vd. add_vocab) hoặc một từ trong phần chức năng."
          className="py-8"
        />
      ) : (
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32 sm:w-44">Tên</TableHead>
              <TableHead className="w-20 sm:w-24">Loại</TableHead>
              <TableHead>Chức năng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((entry) => (
              <TableRow key={entry.name}>
                <TableCell className="align-top">
                  <code className="break-words">{entry.name}</code>
                </TableCell>
                <TableCell className="align-top">
                  <Badge
                    variant={entry.kind === 'prompt' ? 'default' : 'secondary'}
                    className="w-fit"
                  >
                    {entry.kind}
                  </Badge>
                </TableCell>
                <TableCell className="align-top whitespace-normal">{entry.summary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
