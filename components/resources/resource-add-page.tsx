'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { PageShell } from '@/components/shell/page-shell';
import { TabSelect } from '@/components/shared/tab-select';
import {
  INPUT_TABS,
  ResourceAddPanels,
  type ResourceKind,
} from '@/components/resources/resource-add-form';

/**
 * `/resources/new` — the route host for the add form (the dialog host is `ResourceAddForm`).
 *
 * It exists to own the `<Tabs>` state ABOVE `PageShell`, which is what lets the tab switcher render in
 * `headerAside` instead of at the top of the body: on the header row the switcher sits beside the
 * breadcrumb from md up, and is pinned to the right edge below it (PageShell's `ml-auto`) — the same
 * placement the learner already knows from /resources, /history and /settings. Before this it was a
 * full-width control stacked under the crumb, which read as page content rather than as chrome and cost
 * a whole row of a phone viewport.
 *
 * Same shape as `ResourcesView`: a client component that renders the (dependency-free) server-side
 * PageShell, so the Tabs provider can wrap the header and the body at once.
 */
export function ResourceAddPage({ kind }: { kind: ResourceKind }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>('single');

  const done = () => {
    router.push('/resources');
    router.refresh();
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        section={kind}
        action="add"
        width="form"
        headerAside={
          <TabSelect items={INPUT_TABS} value={tab} onValueChange={setTab} label="Cách nhập" />
        }
      >
        {/* Card, so the page reads like the rest of the app (2026-08-05). The fields used to sit bare on
            the page background — no surface, no edge — which is the one shape nothing else here uses:
            /settings puts its fields on cards, so do the item detail, the group cards and the history
            entries. The DIALOG host keeps no card, because the dialog already IS the surface. */}
        <Card>
          <CardContent>
            <ResourceAddPanels kind={kind} onDone={done} />
          </CardContent>
        </Card>
      </PageShell>
    </Tabs>
  );
}
