'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { KhoTrail } from '@/components/layout/kho-trail';
import { GroupForm } from '@/components/features/groups/group-form';
import type { GroupSummary } from '@/lib/library/groups';

export function GroupFormPage({ group }: { group?: GroupSummary }) {
  const router = useRouter();

  const done = () => {
    router.push(group ? `/groups/${group.id}` : '/resources?tab=groups');
    router.refresh();
  };

  return (
    <PageShell
      template="form"
      breadcrumb={<KhoTrail place={{ way: 'groups' }} />}
      title={group ? 'Sửa nhóm' : 'Thêm nhóm'}
    >
      <Card>
        <CardContent>
          <GroupForm group={group} onDone={done} onCancel={() => router.back()} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
