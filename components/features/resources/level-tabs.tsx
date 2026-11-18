'use client';

import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/page-tabs';
import { LEVEL_TABS } from '@/components/layout/page-heads';
import { LEVEL_VIEWS, type LevelView } from '@/lib/library/level-views';

// The level screen's views (U4c4) as page tabs whose open tab lives in the address: picking one
// asks the server for that view, so a level of 3,000 words never sends every view at once. The old
// view stays, dimmed, until the new one arrives.
export function LevelTabs({
  view,
  hrefs,
  children,
}: {
  view: LevelView;
  hrefs: Record<LevelView, string>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Tabs
      value={view}
      onValueChange={(v) => {
        if (!(LEVEL_VIEWS as readonly unknown[]).includes(v) || v === view) return;
        start(() => router.push(hrefs[v as LevelView], { scroll: false }));
      }}
      // LevelTabContent dims itself while the root is busy (group-aria-busy/tabs).
      aria-busy={pending || undefined}
    >
      {children}
    </Tabs>
  );
}

export { TabsContent as LevelTabContent };

// Client side, as the tabs' icons are functions a server component cannot hand over.
export function LevelTabList() {
  return <PageTabs items={LEVEL_TABS.items} label={LEVEL_TABS.label} />;
}
