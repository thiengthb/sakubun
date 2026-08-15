'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { GroupForm } from '@/components/features/groups/group-form';
import type { GroupSummary } from '@/lib/library/groups';

export function GroupFormPage({ group }: { group?: GroupSummary }) {
  const router = useRouter();

  const done = () => {
    router.push(group ? `/groups/${group.id}` : '/resources?tab=groups');
    router.refresh();
  };

  return (
    <PageShell section="groups" action={group ? 'edit' : 'add'} width="form">
      <p className="text-muted-foreground">
        {group
          ? 'Đổi tên, loại hoặc ghi chú. Thu hẹp loại KHÔNG gỡ mục đang có — nó chỉ chặn mục mới không đúng loại.'
          : 'Đặt tên và chọn loại. Loại quyết định mục nào được thêm vào nhóm.'}
      </p>
      <Card>
        <CardContent>
          <GroupForm group={group} onDone={done} onCancel={() => router.back()} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
