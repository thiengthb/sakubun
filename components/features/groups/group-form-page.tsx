'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { TitleSubject } from '@/components/common/title-subject';
import { PageShell } from '@/components/layout/page-shell';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
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
      breadcrumb={<ParentCrumbs section="groups" self />}
      title={group ? <TitleSubject subject={group.name}>Sửa nhóm</TitleSubject> : 'Thêm nhóm'}
    >
      <Card>
        <CardContent>
          <GroupForm group={group} onDone={done} onCancel={() => router.back()} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
