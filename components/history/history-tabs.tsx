'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AutoShareToggle } from '@/components/resources/auto-share-toggle';
import { EmptyState } from '@/components/shared/empty-state';
import { HistoryList } from '@/components/history/history-list';
import { CommunityFeed, type Viewer } from '@/components/library/community-feed';
import { PageShell } from '@/components/shell/page-shell';
import { furiganaInApp, type FuriganaMode } from '@/lib/settings-schema';
import type { SentenceHistoryRow } from '@/lib/practice';
import type { FeedEntry } from '@/lib/feed';

/**
 * /history shell: "Của tôi" (your own attempts, the existing HistoryList) + "Cộng đồng" (the members'
 * shared feed + comments). A tab, not a separate route — consistent with the resources "Nhóm" tab.
 * Controlled so the community-only "tự chia sẻ" toggle can sit on the header row (beside the tabs)
 * and appear ONLY when the Cộng đồng tab is active.
 */
export function HistoryTabs({
  sentences,
  feed,
  viewer,
  voiceSpeaker,
  speechRate,
  furiganaMode = 'app',
  autoShareSentences = false,
}: {
  sentences: SentenceHistoryRow[];
  feed: FeedEntry[];
  viewer: Viewer;
  voiceSpeaker?: number;
  speechRate?: number;
  furiganaMode?: FuriganaMode;
  autoShareSentences?: boolean;
}) {
  const [tab, setTab] = useState('mine');
  const audio = { voiceSpeaker, speechRate, showFurigana: furiganaInApp(furiganaMode) };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        section="history"
        headerAside={
          <>
            <TabsList>
              <TabsTrigger value="mine">Của tôi</TabsTrigger>
              <TabsTrigger value="community">Cộng đồng</TabsTrigger>
            </TabsList>
            {/* Community-only control, pulled up to the header row (right) so the feed body starts
                with its own search/filter toolbar — parity with the "Của tôi" tab. */}
            {tab === 'community' && (
              <AutoShareToggle enabled={autoShareSentences} className="sm:ml-auto" />
            )}
          </>
        }
      >
        <TabsContent value="mine">
          {sentences.length === 0 ? (
            <EmptyState
              title="Chưa có lượt dịch nào"
              description={
                <>
                  Mở Claude Desktop và chạy prompt <code>practice</code> để bắt đầu.
                </>
              }
            />
          ) : (
            <HistoryList
              sentences={sentences}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              furiganaMode={furiganaMode}
            />
          )}
        </TabsContent>

        <TabsContent value="community">
          <CommunityFeed feed={feed} audio={audio} viewer={viewer} />
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
