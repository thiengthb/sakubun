import type { Metadata } from 'next';
import { ResourceAddPage } from '@/components/features/resources/resource-add-page';
import { getSessionUserId } from '@/lib/auth/current-user';

export const metadata: Metadata = { title: 'Thêm vào kho — sakubun' };
export const dynamic = 'force-dynamic';

export default async function ResourceAddRoute({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  await getSessionUserId();
  const { kind } = await searchParams;

  return <ResourceAddPage kind={kind === 'vocab' ? 'vocab' : 'grammar'} />;
}
