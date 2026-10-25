'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/page-shell';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageTabs } from '@/components/common/page-tabs';
import { INPUT_TABS } from '@/components/layout/page-heads';
import {
  ResourceAddPanels,
  type ResourceKind,
} from '@/components/features/resources/resource-add-form';

export function ResourceAddPage({ kind }: { kind: ResourceKind }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>(INPUT_TABS.initial);

  const done = () => {
    router.push(`/resources?tab=${kind}`);
    router.refresh();
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="form"
        breadcrumb={<ParentCrumbs section={kind} self />}
        title={kind === 'grammar' ? 'Thêm ngữ pháp' : 'Thêm từ vựng'}
        tabs={<PageTabs items={INPUT_TABS.items} label={INPUT_TABS.label} />}
      >
        <Card>
          <CardContent>
            <ResourceAddPanels kind={kind} onDone={done} />
          </CardContent>
        </Card>
      </PageShell>
    </Tabs>
  );
}
