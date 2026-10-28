import { notFound } from 'next/navigation';
import DashboardLoading from '@/app/loading';
import HistoryLoading from '@/app/history/loading';
import ReviewLoading from '@/app/review/loading';
import SettingsLoading from '@/app/settings/loading';
import ResourcesLoading from '@/app/resources/loading';
import ResourceAddLoading from '@/app/resources/new/loading';
import ItemLoading from '@/app/resources/[id]/loading';
import ItemEditLoading from '@/app/resources/[id]/edit/loading';
import GroupLoading from '@/app/groups/[id]/loading';
import GroupAddItemsLoading from '@/app/groups/[id]/add/loading';
import GroupEditLoading from '@/app/groups/[id]/edit/loading';
import GroupNewLoading from '@/app/groups/new/loading';
import KaiwaLoading from '@/app/kaiwa/loading';
import KaiwaScriptLoading from '@/app/kaiwa/[id]/loading';
import KaiwaNewLoading from '@/app/kaiwa/new/loading';
import LibraryLoading from '@/app/library/loading';
import LibraryGroupLoading from '@/app/library/[id]/loading';

const SKELETONS: Record<string, () => React.ReactElement> = {
  dashboard: DashboardLoading,
  resources: ResourcesLoading,
  'resources-new': ResourceAddLoading,
  item: ItemLoading,
  'item-edit': ItemEditLoading,
  history: HistoryLoading,
  review: ReviewLoading,
  settings: SettingsLoading,
  group: GroupLoading,
  'group-new': GroupNewLoading,
  'group-edit': GroupEditLoading,
  'group-add': GroupAddItemsLoading,
  kaiwa: KaiwaLoading,
  'kaiwa-script': KaiwaScriptLoading,
  'kaiwa-new': KaiwaNewLoading,
  library: LibraryLoading,
  'library-group': LibraryGroupLoading,
};

export default async function DevSkeletonPage({ params }: { params: Promise<{ route: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { route } = await params;
  // The route error page (app/error.tsx), for screenshots: nothing else throws on purpose.
  if (route === 'error') throw new Error('dev-skeleton: a page that failed to load');
  const Skeleton = SKELETONS[route];
  if (!Skeleton) notFound();
  return <Skeleton />;
}
