import { redirect } from 'next/navigation';
import { NotificationsView } from '@/components/notifications/notifications-view';
import { PageShell } from '@/components/shell/page-shell';
import { LiveRefresh } from '@/components/shell/live-refresh';
import { getOptionalSessionUser } from '@/lib/current-user';
import { listNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const viewer = await getOptionalSessionUser();
  if (!viewer) redirect('/login');
  const items = await listNotifications(viewer.id);

  return (
    <PageShell section="notifications" width="wide">
      {/* Notifications are written out of band (Claude via MCP, other members' likes/comments), so this
          page mirrors data the browser cannot know changed — the same reason /history polls. */}
      <LiveRefresh />
      <NotificationsView items={items} />
    </PageShell>
  );
}
