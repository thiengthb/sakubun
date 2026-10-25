'use client';

import { Layers, Target } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { GROUP_TABS } from '@/components/layout/page-heads';
import { EmptyState } from '@/components/common/empty-state';
import { PageTabs } from '@/components/common/page-tabs';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { useSessionState } from '@/components/common/use-session-state';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AddButton } from '@/components/common/add-button';
import { GroupEditButton } from '@/components/features/groups/group-actions';
import { GroupCards } from '@/components/features/groups/group-cards';
import { GroupItemTable } from '@/components/features/groups/group-item-table';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import type { GroupDetail } from '@/lib/library/groups';
import type { QuickCard } from '@/lib/app/quick-review';

// List template: the group's name is the h1, its size, kind and note the meta; Thêm opens the
// add-items page, Sửa the edit page, and Luyện nhóm (once there is something to practise) copies
// the command for the MCP client.
export function GroupDetailView({
  group,
  cards,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  group: GroupDetail;
  cards: QuickCard[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const [tab, setTab] = useSessionState(GROUP_TABS.storeKey, GROUP_TABS.initial);
  const mixed = group.kind === 'mixed';
  const kinds = mixed ? 'ngữ pháp và từ vựng' : GROUP_KIND_LABELS[group.kind].toLowerCase();

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="list"
        breadcrumb={<ParentCrumbs section="groups" self />}
        title={group.name}
        meta={
          <>
            {group.members.length} mục · {GROUP_KIND_LABELS[group.kind]}
            {group.note && <> · {group.note}</>}
          </>
        }
        actions={
          <>
            {group.members.length > 0 && (
              <CopyCommandButton
                command={`luyện nhóm ${group.name}`}
                label="Luyện nhóm"
                size="default"
                icon={Target}
              />
            )}
            <GroupEditButton group={group} />
            <AddButton href={`/groups/${group.id}/add`} />
          </>
        }
        actionsOnPhone="split"
        tabs={<PageTabs items={GROUP_TABS.items} label={GROUP_TABS.label} />}
      >
        <TabsContent value="list">
          {group.members.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Nhóm chưa có mục nào"
              description={
                <>
                  Bấm Thêm để chọn {kinds} cho nhóm, hoặc chọn nhiều mục ở Tài nguyên rồi thêm vào
                  nhóm.
                </>
              }
            />
          ) : (
            <GroupItemTable
              mode="members"
              groupId={group.id}
              items={group.members}
              mixed={mixed}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
            />
          )}
        </TabsContent>

        <TabsContent value="flashcard">
          <GroupCards
            key={cards.map((c) => c.itemId).join(',')}
            cards={cards}
            showFurigana={showFurigana}
            tts={{ voiceSpeaker, speechRate }}
          />
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
