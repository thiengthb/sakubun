'use client';

import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/empty-state';
import { PageTabs } from '@/components/common/page-tabs';
import { SectionHeading } from '@/components/common/section-heading';
import { useSessionState } from '@/components/common/use-session-state';
import { PageShell } from '@/components/layout/page-shell';
import { LIBRARY_TABS } from '@/components/layout/page-heads';
import {
  LibraryGroupCard,
  type LibraryGroupRow,
} from '@/components/features/library/library-group-card';
import { LibraryItems } from '@/components/features/library/library-items';
import { LibraryLevels } from '@/components/features/library/library-levels';
import type { LibraryEntryRow } from '@/lib/library/browse';
import type { BrowseQuery } from '@/lib/library/browse-query';
import { OPENJLPT_ORIGIN } from '@/lib/library/shared';

// List template (phase 8, L2): the shared library. Groups first, the way thien shares related items
// (a whole level, a topic): OpenJLPT's as a table by level, then the learners' (7.4h); single entries
// under "Từng mục" (LibraryItems), searched on the server.
export function LibraryView({
  groups,
  entries,
  entriesTotal,
  entriesMeta,
  search,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  groups: LibraryGroupRow[];
  entries: LibraryEntryRow[];
  /** All the entries the search finds; `entries` is the first page of them. */
  entriesTotal: number;
  /** "518 ngữ pháp, 7.625 từ vựng" or "12 mục khớp". */
  entriesMeta: string;
  search: BrowseQuery;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const [tab, setTab] = useSessionState(
    LIBRARY_TABS.storeKey,
    LIBRARY_TABS.initial,
    LIBRARY_TABS.urlKey,
  );
  const openJlpt = groups.filter((g) => g.origin === OPENJLPT_ORIGIN);
  const community = groups.filter((g) => g.origin !== OPENJLPT_ORIGIN);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="list"
        title="Kho chung"
        meta={tab === 'items' ? entriesMeta : `${groups.length} nhóm`}
        tabs={<PageTabs items={LIBRARY_TABS.items} label={LIBRARY_TABS.label} />}
      >
        <TabsContent value="groups" className="space-y-6 md:space-y-8">
          {openJlpt.length > 0 && (
            <section className="space-y-3">
              <SectionHeading
                title="OpenJLPT theo cấp"
                hint="Toàn bộ ngữ pháp và từ vựng của mỗi cấp. Bấm một ô để xem nhóm và lấy về kho."
              />
              <LibraryLevels groups={openJlpt} />
            </section>
          )}
          <section className="space-y-3">
            <SectionHeading
              title="Cộng đồng"
              hint="Nhóm người học chia sẻ, nhiều lượt lấy trước."
            />
            {community.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="Chưa có nhóm nào do người học chia sẻ"
                description={
                  <>
                    Muốn chia sẻ nhóm của bạn: mở nhóm ở{' '}
                    <Link href="/resources?tab=groups" className="underline underline-offset-2">
                      Tài nguyên › Nhóm
                    </Link>{' '}
                    rồi bấm Chia sẻ.
                  </>
                }
              />
            ) : (
              <div className="@container">
                <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
                  {community.map((g) => (
                    <LibraryGroupCard key={g.id} group={g} />
                  ))}
                </ul>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="items">
          <LibraryItems
            entries={entries}
            total={entriesTotal}
            search={search}
            voiceSpeaker={voiceSpeaker}
            speechRate={speechRate}
            showFurigana={showFurigana}
          />
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
