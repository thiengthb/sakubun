'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, SearchX } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { FormFooter, PageShell } from '@/components/layout/page-shell';
import { GroupItemTable } from '@/components/features/groups/group-item-table';
import { addItemsToGroupAction } from '@/app/actions';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import type { GroupDetail, GroupMemberItem } from '@/lib/library/groups';

// Form template: tick the items to add in the list template's table (cards on a phone), then add
// them from the footer, which stays in reach while the list scrolls.
export function GroupItemPicker({
  group,
  addable,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  group: GroupDetail;
  addable: GroupMemberItem[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const mixed = group.kind === 'mixed';
  const kinds = mixed ? 'ngữ pháp và từ vựng' : GROUP_KIND_LABELS[group.kind].toLowerCase();
  const back = `/groups/${group.id}`;

  const submit = () => {
    if (selected.length === 0) return;
    startTransition(async () => {
      const r = await addItemsToGroupAction(group.id, selected);
      if (toastResult(r, (d) => `Đã thêm ${d.added} mục`)) {
        router.push(back);
        router.refresh();
      }
    });
  };

  return (
    <PageShell
      template="form"
      breadcrumb={<ParentCrumbs section="groups" self record={{ label: group.name, href: back }} />}
      title="Thêm mục"
      meta={`Chỉ hiện ${kinds} chưa thuộc nhóm.`}
    >
      {addable.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Không còn mục nào để thêm"
          description={`Mọi ${kinds} trong kho đã ở trong nhóm này.`}
        />
      ) : (
        <>
          <GroupItemTable
            mode="pick"
            groupId={group.id}
            items={addable}
            mixed={mixed}
            onSelectionChange={setSelected}
            voiceSpeaker={voiceSpeaker}
            speechRate={speechRate}
            showFurigana={showFurigana}
          />
          <FormFooter status={`Đã chọn ${selected.length} mục`}>
            <Button variant="outline" onClick={() => router.push(back)} disabled={isPending}>
              Huỷ
            </Button>
            <Button onClick={submit} disabled={isPending || selected.length === 0}>
              <Plus aria-hidden />
              Thêm
            </Button>
          </FormFooter>
        </>
      )}
    </PageShell>
  );
}
