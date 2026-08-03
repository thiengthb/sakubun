'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { GitFork } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Truncate } from '@/components/ui/truncate';
import { Explain } from '@/components/shared/explain';
import { BulkForkButton } from '@/components/resources/bulk-fork-button';
import { BulkShareButton } from '@/components/resources/bulk-share-button';
import { DataTable } from '@/components/shared/data-table';
import { FilterPopover, FilterRow } from '@/components/shared/filter-popover';
import { ItemDetailDialog } from '@/components/resources/item-detail-dialog';
import { LibraryForkButton } from '@/components/library/library-fork-button';
import { LibraryLikeButton } from '@/components/library/library-like-button';
import { SpokenLine } from '@/components/shared/spoken-line';
import { UserAvatar } from '@/components/shell/user-avatar';
import { useSessionState } from '@/components/shared/use-session-state';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { JLPT_LEVELS } from '@/lib/settings-schema';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { toRomaji } from '@/lib/romaji';
import { speakable } from '@/lib/format';
import type { LibraryEntry } from '@/lib/library';

/** A LibraryEntry with the derived "already in my kho" flag (server `alreadyMine` OR forked this session). */
type LibraryRow = LibraryEntry & { owned: boolean };

interface AudioProps {
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}

/**
 * One /library tab (grammar OR vocab) as a <DataTable>: browse OTHERS' shared items and take them into
 * your kho. Thin config over the reusable table — it owns COLUMNS (audio term + detail-dialog, meaning,
 * owner, fork count, actions) and the domain FILTERS (level / in-kho), pre-filtering the rows; DataTable
 * owns sort / search / pagination (incl. auto page size) / column layout + their persistence.
 */
export function LibraryTable({
  kind,
  entries,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  kind: 'grammar' | 'vocab';
  entries: LibraryEntry[];
} & AudioProps) {
  // Items taken THIS session — flip the row to "owned" instantly (revalidate confirms server-side).
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [level, setLevel] = useSessionState<string>(`library.${kind}.level`, 'all', `${kind}lvl`);
  const [owned, setOwned] = useSessionState<string>(`library.${kind}.owned`, 'all', `${kind}own`);
  // Source filter: whose shared item is it — everyone / the ones I'M sharing / others'. Pairs with the
  // bulk "ngừng chia sẻ" below (isolate your own shared rows to unshare them).
  const [source, setSource] = useSessionState<string>(
    `library.${kind}.source`,
    'all',
    `${kind}src`,
  );

  const onForked = useCallback((id: string) => setTaken((s) => new Set(s).add(id)), []);

  const rows = useMemo<LibraryRow[]>(
    () => entries.map((e) => ({ ...e, owned: e.alreadyMine || taken.has(e.id) })),
    [entries, taken],
  );
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (level !== 'all' && r.level !== level) return false;
        if (owned === 'yes' && !r.owned) return false;
        if (owned === 'no' && r.owned) return false;
        if (source === 'mine' && !r.isMine) return false;
        if (source === 'others' && r.isMine) return false;
        return true;
      }),
    [rows, level, owned, source],
  );

  const columns = useMemo<ColumnDef<LibraryRow>[]>(
    () => [
      {
        id: 'expression',
        // accessor drives BOTH sort and global search → include reading AND romaji so kana OR romaji hit.
        accessorFn: (r) =>
          `${r.expression} ${r.reading ?? ''} ${toRomaji(r.reading ?? '')} ${toRomaji(r.expression)}`,
        header: kind === 'grammar' ? 'Mẫu ngữ pháp' : 'Từ',
        enableHiding: false,
        size: 260,
        minSize: 150,
        meta: { label: kind === 'grammar' ? 'Mẫu ngữ pháp' : 'Từ' },
        cell: ({ row }) => {
          const e = row.original;
          return (
            <SpokenLine
              text={e.expression}
              speakText={speakable(e.expression)}
              ruby={buildFuriganaMarkup(e.expression, e.reading)}
              showFurigana={showFurigana}
              speaker={voiceSpeaker}
              rate={speechRate}
              label={kind === 'grammar' ? 'Nghe mẫu' : 'Nghe từ'}
              truncate
            />
          );
        },
      },
      {
        accessorKey: 'meaningVi',
        header: 'Nghĩa',
        size: 240,
        minSize: 120,
        meta: { label: 'Nghĩa' },
        cell: ({ row }) => <Truncate>{row.original.meaningVi}</Truncate>,
      },
      {
        accessorKey: 'level',
        header: 'Level',
        size: 80,
        minSize: 60,
        meta: { label: 'Level' },
      },
      {
        id: 'owner',
        accessorFn: (r) => r.ownerName,
        header: 'Người chia sẻ',
        size: 150,
        minSize: 100,
        meta: { label: 'Người chia sẻ' },
        cell: ({ row }) => (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <UserAvatar name={row.original.ownerName} image={row.original.ownerImage} size="xs" />
            <span className="truncate">
              {row.original.ownerName}
              {row.original.isMine ? ' (bạn)' : ''}
            </span>
          </span>
        ),
      },
      {
        id: 'forkCount',
        accessorFn: (r) => r.forkCount,
        header: 'Lượt lấy',
        size: 90,
        minSize: 70,
        enableGlobalFilter: false,
        meta: { label: 'Lượt lấy', cellClassName: 'tabular-nums text-muted-foreground' },
        cell: ({ row }) =>
          row.original.forkCount > 0 ? (
            <Explain text="Số người đã lấy mục này về kho riêng của họ.">
              <span className="inline-flex items-center gap-1">
                <GitFork className="size-3.5" aria-hidden />
                {row.original.forkCount}
              </span>
            </Explain>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'likeCount',
        accessorFn: (r) => r.likeCount,
        header: 'Thích',
        size: 90,
        minSize: 72,
        enableGlobalFilter: false,
        meta: { label: 'Thích' },
        cell: ({ row }) => (
          <LibraryLikeButton
            itemId={row.original.id}
            count={row.original.likeCount}
            likedByMe={row.original.likedByMe}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 96,
        minSize: 84,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        meta: { noReorder: true },
        cell: ({ row }) => {
          const e = row.original;
          return (
            <div className="flex items-center justify-end gap-0.5">
              <ItemDetailDialog
                item={{
                  expression: e.expression,
                  reading: e.reading,
                  hanviet: e.hanviet,
                  meaningVi: e.meaningVi,
                  notes: e.notes,
                  level: e.level,
                  enrichment: e.enrichment,
                  suspended: false,
                  srs: null,
                }}
                kind={kind}
                triggerVariant="icon"
                showSrs={false}
                voiceSpeaker={voiceSpeaker}
                speechRate={speechRate}
                showFurigana={showFurigana}
              />
              {e.isMine ? (
                <Explain text="Mục này do chính bạn chia sẻ lên thư viện chung, nên không cần lấy về.">
                  <span className="text-xs whitespace-nowrap text-muted-foreground">Của bạn</span>
                </Explain>
              ) : (
                <LibraryForkButton id={e.id} owned={e.owned} onForked={() => onForked(e.id)} />
              )}
            </div>
          );
        },
      },
    ],
    [kind, onForked, voiceSpeaker, speechRate, showFurigana],
  );

  const filterCount =
    (level !== 'all' ? 1 : 0) + (owned !== 'all' ? 1 : 0) + (source !== 'all' ? 1 : 0);

  return (
    <DataTable
      columns={columns}
      data={filtered}
      getRowId={(r) => r.id}
      persistKey={`library-${kind}`}
      urlPrefix={`l${kind === 'grammar' ? 'g' : 'v'}.`}
      pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
      searchPlaceholder="Tìm theo mẫu / cách đọc / nghĩa…"
      countNoun={kind === 'grammar' ? 'mẫu' : 'từ'}
      totalCount={entries.length}
      emptyMessage="Không có mục nào khớp bộ lọc."
      enableRowNumbers
      enableRowSelection
      bulkActions={(selected, clear) => {
        // Takeable = not already in my kho AND not my own shared row (own-item + dup guard is also
        // re-checked server-side; this just narrows what the button offers).
        const takeableIds = selected.filter((r) => !r.owned && !r.isMine).map((r) => r.id);
        // My OWN shared rows in this selection — the only ones I can "ngừng chia sẻ" from here (every
        // library row is public, so the direction is always unshare). Server re-checks ownership.
        const mineIds = selected.filter((r) => r.isMine).map((r) => r.id);
        return (
          <>
            <BulkForkButton
              ids={takeableIds}
              noun={kind === 'grammar' ? 'mẫu' : 'từ'}
              onDone={() => {
                setTaken((s) => {
                  const next = new Set(s);
                  takeableIds.forEach((id) => next.add(id));
                  return next;
                });
                clear();
              }}
            />
            <BulkShareButton
              ids={mineIds}
              noun={kind === 'grammar' ? 'mẫu' : 'từ'}
              share={false}
              onDone={clear}
            />
          </>
        );
      }}
      filterSlot={
        <FilterPopover
          activeCount={filterCount}
          onReset={() => {
            setLevel('all');
            setOwned('all');
            setSource('all');
          }}
        >
          <FilterRow label="Cấp độ">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">Mọi cấp</SelectItem>
                {JLPT_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterRow>
          <FilterRow label="Trong kho">
            <Select value={owned} onValueChange={setOwned}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="no">Chưa có</SelectItem>
                <SelectItem value="yes">Đã có</SelectItem>
              </SelectContent>
            </Select>
          </FilterRow>
          <FilterRow label="Nguồn chia sẻ">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="mine">Tôi đang chia sẻ</SelectItem>
                <SelectItem value="others">Người khác chia sẻ</SelectItem>
              </SelectContent>
            </Select>
          </FilterRow>
        </FilterPopover>
      }
    />
  );
}
