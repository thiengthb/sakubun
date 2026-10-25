import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { ItemEditForm } from '@/components/features/resources/item-edit-form';
import { ItemGuide } from '@/components/features/resources/item-guide';
import { getItemStats } from '@/lib/insights/item-stats';
import { getSessionUserId } from '@/lib/auth/current-user';

export const metadata: Metadata = { title: 'Sửa mục — sakubun' };
export const dynamic = 'force-dynamic';

export default async function ItemEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getSessionUserId();
  const stats = await getItemStats(id);
  if (!stats) notFound();

  return (
    <PageShell
      template="form"
      breadcrumb={<ParentCrumbs section={stats.kind} self />}
      title={stats.kind === 'vocab' ? 'Sửa từ vựng' : 'Sửa ngữ pháp'}
    >
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
      <ItemGuide kind={stats.kind} editing />
    </PageShell>
  );
}
