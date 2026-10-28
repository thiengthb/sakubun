'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '@/components/common/empty-state';
import { ScrollMoreStatus } from '@/components/common/scroll-more-status';
import { SearchInput } from '@/components/common/search-input';
import { useServerScrollMore } from '@/components/common/use-server-scroll-more';
import { LibraryEntryCard } from '@/components/features/library/library-entry-card';
import { moreEntriesAction } from '@/app/library/actions';
import type { LibraryEntryRow } from '@/lib/library/browse';
import { browseParams, type BrowseQuery } from '@/lib/library/browse-query';
import { JLPT_LEVELS } from '@/lib/settings/schema';

const TYPES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'GRAMMAR', label: 'Ngữ pháp' },
  { value: 'VOCAB', label: 'Từ vựng' },
] as const;

const SORTS = [
  { value: 'popular', label: 'Phổ biến' },
  { value: 'new', label: 'Mới' },
] as const;

// Kho chung's "Từng mục" (7.4i): searched, filtered and sorted on the server through the URL; the
// first page comes with the page and the rest loads as the list scrolls.
export function LibraryItems({
  entries,
  total,
  search,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  entries: LibraryEntryRow[];
  total: number;
  search: BrowseQuery;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(search.q);
  const params = browseParams(search);
  const listKey = params.toString();
  const go = (next: Partial<BrowseQuery>) =>
    router.replace(`/library?${browseParams({ ...search, q, ...next })}`);
  const load = useCallback(
    (skip: number) => moreEntriesAction(Object.fromEntries(new URLSearchParams(listKey)), skip),
    [listKey],
  );
  const { rows, hasMore, sentinelRef } = useServerScrollMore(entries, total, listKey, load);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          role="search"
          className="w-full sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q });
          }}
        >
          <SearchInput
            type="search"
            aria-label="Tìm trong kho chung"
            placeholder="店, cửa hàng, 〜ばかりに"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <ToggleGroup
          type="single"
          variant="choice"
          aria-label="Loại"
          value={search.type}
          onValueChange={(type) => type && go({ type: type as BrowseQuery['type'] })}
        >
          {TYPES.map((t) => (
            <ToggleGroupItem key={t.value} value={t.value} className="px-3">
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          type="single"
          variant="choice"
          aria-label="Cấp JLPT"
          value={search.level}
          onValueChange={(level) => level && go({ level })}
        >
          <ToggleGroupItem value="all" className="px-3">
            Mọi cấp
          </ToggleGroupItem>
          {JLPT_LEVELS.map((l) => (
            <ToggleGroupItem key={l} value={l} className="px-3">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          type="single"
          variant="choice"
          aria-label="Sắp xếp"
          value={search.sort}
          onValueChange={(sort) => sort && go({ sort: sort as BrowseQuery['sort'] })}
        >
          {SORTS.map((s) => (
            <ToggleGroupItem key={s.value} value={s.value} className="px-3">
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Toggle
          variant="choice"
          className="px-3"
          pressed={search.hideOwned}
          onPressedChange={(hideOwned) => go({ hideOwned })}
        >
          Ẩn mục đã có
        </Toggle>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Không có mục nào khớp"
          description="Thử chữ khác, hoặc bỏ bớt bộ lọc."
        />
      ) : (
        <>
          <div className="@container">
            <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
              {rows.map((e) => (
                <LibraryEntryCard
                  key={e.id}
                  entry={e}
                  showFurigana={showFurigana}
                  voiceSpeaker={voiceSpeaker}
                  speechRate={speechRate}
                />
              ))}
            </ul>
          </div>
          <ScrollMoreStatus ref={sentinelRef} hasMore={hasMore} />
        </>
      )}
    </div>
  );
}
