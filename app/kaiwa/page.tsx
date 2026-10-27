import { KaiwaListView } from '@/components/features/kaiwa/kaiwa-list-view';
import { getUserDb } from '@/lib/auth/current-user';
import { listScripts } from '@/lib/kaiwa/scripts';

export const dynamic = 'force-dynamic';

export default async function KaiwaPage() {
  const scripts = await listScripts(await getUserDb());
  return <KaiwaListView scripts={scripts} />;
}
