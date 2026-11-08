'use client';

import { useMemo, useState } from 'react';
import { Download, SearchX } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/empty-state';
import { KanjiDetail } from '@/components/common/kanji-detail';
import { KANJI_GRID, KanjiTile } from '@/components/common/kanji-tile';
import { ScrollMoreStatus } from '@/components/common/scroll-more-status';
import { SearchInput } from '@/components/common/search-input';
import { useScrollMore } from '@/components/common/use-scroll-more';
import { useServerAction } from '@/components/common/use-server-action';
import { HaveBar, haveText } from '@/components/features/library/have-bar';
import { takeKanjiLevelAction } from '@/app/library/actions';
import { filterKanji } from '@/lib/kanji/browse';
import type { KanjiEntry } from '@/lib/kanji/catalog';

// A kanji group of Kho chung (KJ5, docs/plans/2026-11-08-kanji.md › Chỗ trong app): a level's kanji
// as tiles, how many the learner has, and "Lấy cả nhóm", which gives each missing kanji a card. Ôn
// nhanh then brings them in, the learner's daily number of new kanji at a time.

const TILE_STEP = 120;

export function LibraryKanjiLevelView({
  level,
  kanji,
  have,
}: {
  level: string;
  kanji: KanjiEntry[];
  have: string[];
}) {
  const name = `${level} · Kanji`;
  const owned = useMemo(() => new Set(have), [have]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<KanjiEntry | null>(null);
  const take = useServerAction(takeKanjiLevelAction, {
    success: (r) =>
      r.added > 0
        ? `Đã thêm ${r.added} chữ, Ôn nhanh sẽ đưa ra dần theo số kanji mới mỗi ngày`
        : 'Mọi chữ của nhóm đều đã có',
  });
  const shown = useMemo(() => filterKanji(kanji, { level: 'all', query }), [kanji, query]);
  const { items, hasMore, sentinelRef } = useScrollMore(shown, query, TILE_STEP);
  const missing = kanji.length - owned.size;

  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="library" self />}
      title={name}
      meta={`${kanji.length} chữ · Kanji Jōyō`}
      actions={
        missing > 0 && (
          <Button onClick={() => take.run(level)} disabled={take.isPending}>
            <Download aria-hidden />
            {owned.size > 0 ? 'Lấy phần còn thiếu' : 'Lấy cả nhóm'}
          </Button>
        )
      }
      actionsOnPhone="split"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div data-slot="group-have" className="flex min-w-48 flex-1 items-center gap-3">
            <HaveBar have={owned.size} size={kanji.length} label={name} className="flex-1" />
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
              {haveText(owned.size, kanji.length)}
            </span>
          </div>
          <form role="search" className="w-full sm:w-auto" onSubmit={(e) => e.preventDefault()}>
            <SearchInput
              type="search"
              aria-label={`Tìm trong ${name}`}
              placeholder="経, kinh, đi qua"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={SearchX} title="Không có chữ nào khớp" description="Thử chữ khác." />
        ) : (
          <div className="@container">
            <ul className={KANJI_GRID}>
              {items.map((k) => (
                <KanjiTile
                  key={k.kanji}
                  kanji={k}
                  owned={owned.has(k.kanji)}
                  onOpen={() => setOpen(k)}
                />
              ))}
            </ul>
            <ScrollMoreStatus ref={sentinelRef} hasMore={hasMore} className="mt-2" />
          </div>
        )}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          {open && <KanjiDetail kanji={open} />}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
