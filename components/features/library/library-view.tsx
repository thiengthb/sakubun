'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, SearchX } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '@/components/common/empty-state';
import { PageTabs } from '@/components/common/page-tabs';
import { SearchInput } from '@/components/common/search-input';
import { useSessionState } from '@/components/common/use-session-state';
import { PageShell } from '@/components/layout/page-shell';
import { LIBRARY_TABS } from '@/components/layout/page-heads';
import {
  LibraryEntryCard,
  type LibraryEntryRow,
} from '@/components/features/library/library-entry-card';
import {
  LibraryGroupCard,
  type LibraryGroupRow,
} from '@/components/features/library/library-group-card';
import { MAX_RESULTS } from '@/lib/library/shared';
import { JLPT_LEVELS } from '@/lib/settings/schema';

const TYPES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'GRAMMAR', label: 'Ngữ pháp' },
  { value: 'VOCAB', label: 'Từ vựng' },
] as const;

// List template (phase 8, L2): the shared library. Groups first, the way thien shares related items
// (a whole level, a topic); single entries under "Từng mục", searched on the server.
export function LibraryView({
  groups,
  entries,
  search,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  groups: LibraryGroupRow[];
  entries: LibraryEntryRow[];
  search: { q: string; type: string; level: string };
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useSessionState(
    LIBRARY_TABS.storeKey,
    LIBRARY_TABS.initial,
    LIBRARY_TABS.urlKey,
  );
  const [q, setQ] = useState(search.q);

  const go = (next: Partial<typeof search>) => {
    const params = new URLSearchParams({ tab: 'items' });
    const merged = { ...search, q, ...next };
    if (merged.q.trim()) params.set('q', merged.q.trim());
    if (merged.type !== 'all') params.set('type', merged.type);
    if (merged.level !== 'all') params.set('level', merged.level);
    router.replace(`/library?${params}`);
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="list"
        title="Kho chung"
        meta={tab === 'items' ? `${entries.length} mục` : `${groups.length} nhóm`}
        tabs={<PageTabs items={LIBRARY_TABS.items} label={LIBRARY_TABS.label} />}
      >
        <TabsContent value="groups">
          {groups.length === 0 ? (
            <EmptyState icon={FolderOpen} title="Kho chung chưa có nhóm nào" />
          ) : (
            <div className="@container">
              <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
                {groups.map((g) => (
                  <LibraryGroupCard key={g.id} group={g} />
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
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
              onValueChange={(type) => type && go({ type })}
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
          </div>
          {entries.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Không có mục nào khớp"
              description="Thử chữ khác, hoặc bỏ bớt bộ lọc."
            />
          ) : (
            <>
              <div className="@container">
                <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
                  {entries.map((e) => (
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
              {entries.length === MAX_RESULTS && (
                <p className="text-xs text-muted-foreground">
                  Hiện {MAX_RESULTS} mục đầu. Tìm hoặc lọc để thu hẹp.
                </p>
              )}
            </>
          )}
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
