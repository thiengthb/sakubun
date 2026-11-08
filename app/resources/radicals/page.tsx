import type { Metadata } from 'next';
import { RadicalsView } from '@/components/features/resources/radicals-view';
import { getUserDb } from '@/lib/auth/current-user';
import { listRadicals } from '@/lib/app/radicals';

export const metadata: Metadata = { title: 'Bộ thủ — sakubun' };
export const dynamic = 'force-dynamic';

export default async function RadicalsPage() {
  return <RadicalsView radicals={await listRadicals(await getUserDb())} />;
}
