'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/shell/page-shell';
import { GroupForm } from '@/components/groups/group-form';
import type { GroupSummary } from '@/lib/groups';

/**
 * Route host for the group create/edit form — `/groups/new` and `/groups/<id>/edit`.
 *
 * Both were Dialogs until 2026-08-05. Why routes: the add/edit pair for a resource item already went
 * modal → page (`/resources/new`, `/resources/<id>/edit`), and a group behaved differently for no reason
 * a learner could see — the same action was a page in one tab of /resources and a modal in another. A
 * route also gets the things a modal cannot: a back button that means "back", a shareable/bookmarkable
 * URL, browser history, and a breadcrumb that says where you are ("Nhóm › Thêm" / "Nhóm › Sửa"). On a
 * phone it matters most: a dialog over a list is a second scroll container inside a viewport that only
 * had room for one.
 *
 * Same shape as `ResourceAddPage`: a client component rendering the server-safe PageShell, so the form's
 * state and the navigation on submit/cancel live in one place.
 */
export function GroupFormPage({ group }: { group?: GroupSummary }) {
  const router = useRouter();

  // Back to where the group lives: the group's own page when editing (you were just there), the Nhóm tab
  // when creating (the new group appears in that list). `refresh()` re-runs the server component so the
  // write is visible immediately — the same pair ResourceAddPage uses.
  const done = () => {
    router.push(group ? `/groups/${group.id}` : '/resources?tab=groups');
    router.refresh();
  };

  return (
    <PageShell section="groups" action={group ? 'edit' : 'add'} width="form">
      <p className="text-muted-foreground">
        {group
          ? 'Đổi tên, loại hoặc ghi chú. Thu hẹp loại KHÔNG gỡ mục đang có — nó chỉ chặn mục mới không đúng loại.'
          : 'Đặt tên và chọn loại. Loại quyết định mục nào được thêm vào nhóm.'}
      </p>
      {/* Card, like every other content surface in the app — the form used to sit as bare fields on the
          page background, which is the one shape nothing else here uses. */}
      <Card>
        <CardContent>
          <GroupForm group={group} onDone={done} onCancel={() => router.back()} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
