import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { KhoTrail } from '@/components/layout/kho-trail';
import { ItemEditForm } from '@/components/features/resources/item-edit-form';
import { ItemGuide } from '@/components/features/resources/item-guide';
import { getItemStats } from '@/lib/insights/item-stats';
import { getUserDb } from '@/lib/auth/current-user';
import { itemPlaceById } from '@/lib/app/item-place';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';

export const metadata: Metadata = { title: 'Sửa mục — sakubun' };
export const dynamic = 'force-dynamic';

export default async function ItemEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  await ensureOpenJlptLibrary();
  const [stats, place] = await Promise.all([getItemStats(db, id), itemPlaceById(db, id)]);
  if (!stats || !place) notFound();

  return (
    <PageShell
      template="form"
      breadcrumb={
        <KhoTrail place={place} extra={[{ label: stats.expression, href: `/resources/${id}` }]} />
      }
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
