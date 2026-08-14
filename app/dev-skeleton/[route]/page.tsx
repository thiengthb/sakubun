import { notFound } from 'next/navigation';
import DashboardLoading from '@/app/loading';
import HistoryLoading from '@/app/history/loading';
import SettingsLoading from '@/app/settings/loading';
import ResourcesLoading from '@/app/resources/loading';
import ResourceAddLoading from '@/app/resources/new/loading';
import ItemLoading from '@/app/resources/[id]/loading';
import ItemEditLoading from '@/app/resources/[id]/edit/loading';
import GroupLoading from '@/app/groups/[id]/loading';
import GroupAddItemsLoading from '@/app/groups/[id]/add/loading';
import GroupEditLoading from '@/app/groups/[id]/edit/loading';
import GroupNewLoading from '@/app/groups/new/loading';

/**
 * DEV-ONLY: renders a route's `loading.tsx` at a URL, so a browser can MEASURE it against the page it
 * stands in for (`e2e/skeleton.spec.ts`). 404 in production — `next build` keeps the route, and the guard
 * is what makes it unreachable on the deploy.
 *
 * Why this exists rather than catching the real loading state: a skeleton is on screen for one paint
 * during a navigation whose payload is prefetched, so it cannot be held still. Every attempt to force it
 * (delaying the RSC fetch, aborting the prefetch) either raced or made Next fall back to a hard
 * navigation that renders the finished page. Meanwhile the drift being gated — a header row that wraps,
 * a 5-pill tab rail on a 390px phone, a table drawn where the page shows cards — is pure geometry, and
 * geometry needs a layout, not a moment in time.
 *
 * The keys are the gate's vocabulary; keep them in step with `e2e/skeleton.spec.ts`. A missing key is a
 * 404, which fails that spec rather than passing quietly.
 */
const SKELETONS: Record<string, () => React.ReactElement> = {
  dashboard: DashboardLoading,
  resources: ResourcesLoading,
  'resources-new': ResourceAddLoading,
  item: ItemLoading,
  'item-edit': ItemEditLoading,
  history: HistoryLoading,
  settings: SettingsLoading,
  group: GroupLoading,
  'group-new': GroupNewLoading,
  'group-edit': GroupEditLoading,
  'group-add': GroupAddItemsLoading,
};

export default async function DevSkeletonPage({ params }: { params: Promise<{ route: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { route } = await params;
  const Skeleton = SKELETONS[route];
  if (!Skeleton) notFound();
  return <Skeleton />;
}
