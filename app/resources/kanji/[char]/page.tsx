import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KanjiPageView } from '@/components/features/resources/kanji-page-view';
import { getUserDb } from '@/lib/auth/current-user';
import { getKanjiPage } from '@/lib/app/kanji-page';

export const dynamic = 'force-dynamic';

const charOf = (raw: string) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ char: string }>;
}): Promise<Metadata> {
  return { title: `${charOf((await params).char)} — sakubun` };
}

// A kanji's own page (KJ6): its strokes, facts and component network.
export default async function KanjiPage({ params }: { params: Promise<{ char: string }> }) {
  const page = await getKanjiPage(await getUserDb(), charOf((await params).char));
  if (!page) notFound();
  return <KanjiPageView page={page} />;
}
