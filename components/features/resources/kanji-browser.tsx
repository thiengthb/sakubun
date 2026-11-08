'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CloudOff, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { LIST_CARD } from '@/components/common/list-card';
import { ScrollMoreStatus } from '@/components/common/scroll-more-status';
import { SearchInput } from '@/components/common/search-input';
import { useScrollMore } from '@/components/common/use-scroll-more';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  filterKanji,
  isKanjiLevelFilter,
  KANJI_LEVEL_FILTERS,
  type KanjiLevelFilter,
} from '@/lib/kanji/browse';
import type { KanjiEntry } from '@/lib/kanji/catalog';
import { cn } from '@/lib/core/utils';

// Tài nguyên › Kanji (KJ2, docs/plans/2026-11-08-kanji.md): the 2,136 Jōyō kanji as tiles, easiest
// level first, each opening its meaning, readings, radical and parts. The list comes from
// /api/kanji when the tab first opens, so the other tabs never carry it.

/** One step of tiles: about 15 rows on a laptop, past the bottom of any screen. */
const TILE_STEP = 120;
const GRID =
  'grid grid-cols-4 gap-2 @md:grid-cols-6 @2xl:grid-cols-8 @4xl:grid-cols-10 @6xl:grid-cols-12';

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
          <div className={GRID}>
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
          <ul className={GRID}>
            {items.map((k) => (
              <li key={k.kanji} data-slot="kanji-tile" className="flex">
                <button
                  type="button"
                  onClick={() => setOpen(k)}
                  className={cn(
                    LIST_CARD.base,
                    'flex aspect-square w-full min-w-0 flex-col items-center justify-center gap-1 p-1 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  )}
                >
                  <span lang="ja" className="text-3xl leading-none">
                    {k.kanji}
                  </span>
                  <span className="max-w-full truncate text-xs text-muted-foreground">
                    [{k.hanviet}]
                  </span>
                </button>
              </li>
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

function KanjiDetail({ kanji: k }: { kanji: KanjiEntry }) {
  const rows: { label: string; value: string; ja?: boolean }[] = [
    { label: 'Cấp', value: k.level ?? 'Ngoài JLPT' },
    { label: 'Số nét', value: String(k.strokes) },
    { label: 'Âm On', value: k.on.join('、'), ja: true },
    { label: 'Âm Kun', value: k.kun.join('、'), ja: true },
    { label: 'Bộ', value: `${k.radical.radical} ${k.radical.nameVi} (bộ số ${k.radical.number})` },
    { label: 'Thành phần', value: k.parts.join(' + '), ja: true },
    { label: 'Phần chỉ âm', value: k.phon ?? '', ja: true },
  ].filter((r) => r.value);
  return (
    <>
      <DialogHeader className="items-center text-center sm:items-center sm:text-center">
        <DialogTitle className="flex flex-col items-center gap-2">
          <span lang="ja" className="text-6xl leading-none font-normal">
            {k.kanji}
          </span>{' '}
          <span>[{k.hanviet}]</span>
        </DialogTitle>
        <DialogDescription>{k.meaningVi || 'Chưa có nghĩa tiếng Việt.'}</DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd lang={r.ja ? 'ja' : undefined} className="min-w-0 break-words">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
