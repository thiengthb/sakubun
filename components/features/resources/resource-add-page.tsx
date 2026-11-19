'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/page-shell';
import { KhoTrail } from '@/components/layout/kho-trail';
import { PageTabs } from '@/components/common/page-tabs';
import { INPUT_TABS } from '@/components/layout/page-heads';
import {
  ResourceAddPanels,
  type ResourceKind,
} from '@/components/features/resources/resource-add-form';

/** `initialTab` comes from `?tab=` (Kho's Add sheet links "Dán nhiều dòng" to the paste tab). */
export function ResourceAddPage({ kind, initialTab }: { kind: ResourceKind; initialTab?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>(() =>
    INPUT_TABS.items.some((t) => t.value === initialTab) ? initialTab! : INPUT_TABS.initial,
  );

  const done = () => {
    router.push(`/resources?tab=${kind}`);
    router.refresh();
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="form"
        breadcrumb={<KhoTrail place={{ way: 'home' }} />}
        title={kind === 'grammar' ? 'Thêm ngữ pháp' : 'Thêm từ vựng'}
        tabs={<PageTabs items={INPUT_TABS.items} label={INPUT_TABS.label} />}
      >
        <ResourceAddPanels kind={kind} onDone={done} />
      </PageShell>
    </Tabs>
  );
}
