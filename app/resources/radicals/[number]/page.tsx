import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RadicalPageView } from '@/components/features/resources/radical-page-view';
import { getUserDb } from '@/lib/auth/current-user';
import { getRadicalPage } from '@/lib/app/radicals';

export const metadata: Metadata = { title: 'Bộ thủ — sakubun' };
export const dynamic = 'force-dynamic';

export default async function RadicalPage({ params }: { params: Promise<{ number: string }> }) {
  const number = Number((await params).number);
  const page = Number.isInteger(number) ? await getRadicalPage(await getUserDb(), number) : null;
  if (!page) notFound();
  return <RadicalPageView page={page} />;
}
