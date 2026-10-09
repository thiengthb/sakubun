import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { ItemEditForm } from '@/components/features/resources/item-edit-form';
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
    <PageShell section={stats.kind === 'vocab' ? 'vocab' : 'grammar'} action="edit" width="form">
      <p className="text-muted-foreground">
        Chỉ sửa nội dung. Lịch ôn (FSRS) của mục được giữ nguyên.
      </p>
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
