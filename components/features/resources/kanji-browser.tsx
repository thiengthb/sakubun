'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CloudOff, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ScrollMoreStatus } from '@/components/common/scroll-more-status';
import { SearchInput } from '@/components/common/search-input';
import { useScrollMore } from '@/components/common/use-scroll-more';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { KanjiDetail } from '@/components/common/kanji-detail';
import { KANJI_GRID, KanjiTile } from '@/components/common/kanji-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  filterKanji,
  isKanjiLevelFilter,
  KANJI_LEVEL_FILTERS,
  type KanjiLevelFilter,
} from '@/lib/kanji/browse';
import type { KanjiEntry } from '@/lib/kanji/catalog';

// Tài nguyên › Kanji (KJ2, docs/plans/2026-11-08-kanji.md): the 2,136 Jōyō kanji as tiles, easiest
// level first, each opening its meaning, readings, radical and parts. The list comes from
// /api/kanji when the tab first opens, so the other tabs never carry it.

/** One step of tiles: about 15 rows on a laptop, past the bottom of any screen. */
const TILE_STEP = 120;

type Load =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: KanjiEntry[] };

export function KanjiBrowser() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [level, setLevel] = useState<KanjiLevelFilter>('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [open, setOpen] = useState<KanjiEntry | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/kanji')
      .then((res) => (res.ok ? (res.json() as Promise<KanjiEntry[]>) : Promise.reject(res.status)))
      .then((entries) => live && setLoad({ status: 'ready', entries }))
      .catch(() => live && setLoad({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [attempt]);

  const entries = load.status === 'ready' ? load.entries : null;
  const shown = useMemo(
    () => (entries ? filterKanji(entries, { level, query: deferredQuery }) : []),
    [entries, level, deferredQuery],
  );
  const { items, hasMore, sentinelRef } = useScrollMore(
    shown,
    `${level}\u0000${deferredQuery}`,
    TILE_STEP,
  );

  if (load.status === 'error')
    return (
      <EmptyState
        icon={CloudOff}
        title="Chưa tải được danh sách kanji"
        description="Kiểm tra mạng rồi thử lại."
        action={
          <Button
            variant="outline"
            onClick={() => {
              setLoad({ status: 'loading' });
              setAttempt((a) => a + 1);
            }}
          >
            Thử lại
          </Button>
        }
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form role="search" className="w-full sm:w-auto" onSubmit={(e) => e.preventDefault()}>
          <SearchInput
            type="search"
            aria-label="Tìm kanji"
            placeholder="経, kinh, đi qua"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <ToggleGroup
          type="single"
          variant="choice"
          aria-label="Cấp JLPT"
          className="flex-wrap"
          value={level}
          onValueChange={(v) => isKanjiLevelFilter(v) && setLevel(v)}
        >
          {KANJI_LEVEL_FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="px-3">
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {load.status === 'loading' ? (
        <div className="@container" role="status" aria-label="Đang tải kanji">
          <div className={KANJI_GRID}>
            {Array.from({ length: 24 }, (_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Không có chữ nào khớp"
          description="Thử chữ khác, hoặc chọn Mọi cấp."
        />
      ) : (
        <div className="@container">
          <ul className={KANJI_GRID}>
            {items.map((k) => (
              <KanjiTile key={k.kanji} kanji={k} onOpen={() => setOpen(k)} />
            ))}
          </ul>
          <ScrollMoreStatus ref={sentinelRef} hasMore={hasMore} className="mt-2" />
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          {open && <KanjiDetail kanji={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
