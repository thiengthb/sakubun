import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/shell/page-shell';
import { ItemEditForm } from '@/components/resources/item-edit-form';
import { getItemStats } from '@/lib/item-stats';
import { getSessionUserId } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Sửa mục — sakubun' };
export const dynamic = 'force-dynamic';

/**
 * "Sửa" for one grammar pattern / vocab word — a ROUTE, not a modal (2026-08-04; see ItemEditForm).
 *
 * Reads through `getItemStats`, the same loader the detail page uses, rather than a second narrower
 * query: it already returns every editable field (kind, expression, reading, meaningVi, level, notes,
 * suspended) plus the auth-scoped existence check, so a missing id 404s here exactly as it does there.
 */
export default async function ItemEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Auth gate: redirects to /login when there is no valid session.
  await getSessionUserId();
  const stats = await getItemStats(id);
  if (!stats) notFound();

  return (
    // `form` width: a five-field content form reads at reading width, not across a 1280px page — the
    // same tier /resources/new uses. The trail is "Ngữ pháp › Sửa" / "Từ vựng › Sửa"; there is no <h1>
    // because the breadcrumb IS the page title (layout std invariant #8) and on a phone a heading that
    // repeats the crumb one line below it costs a row of viewport to say nothing new. The item being
    // edited is named by the first field, which is directly under the hint.
    <PageShell section={stats.kind === 'vocab' ? 'vocab' : 'grammar'} action="edit" width="form">
      <p className="text-muted-foreground">
        Chỉ sửa nội dung. Lịch ôn (FSRS) của mục được giữ nguyên.
      </p>
      {/* Card, same as /resources/new and the group form pages (2026-08-05): a page's content sits on a
          surface everywhere else in this app, and a bare form was the odd one out. */}
      <Card>
        <CardContent>
          <ItemEditForm
            item={{
              itemId: id,
              expression: stats.expression,
              reading: stats.reading,
              meaningVi: stats.meaningVi,
              notes: stats.notes,
              level: stats.level,
              suspended: stats.suspended,
            }}
            kind={stats.kind}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
