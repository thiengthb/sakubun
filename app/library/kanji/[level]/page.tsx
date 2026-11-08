import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LibraryKanjiLevelView } from '@/components/features/library/library-kanji-level-view';
import { getUserDb } from '@/lib/auth/current-user';
import { isKanjiLevel, kanjiLevel } from '@/lib/app/kanji-levels';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ level: string }>;
}): Promise<Metadata> {
  const { level } = await params;
  return { title: `${level} · Kanji — sakubun` };
}

// One of Kho chung's kanji groups (KJ5): the level's kanji from the catalog, and "Lấy cả nhóm".
export default async function LibraryKanjiLevelPage({
  params,
}: {
  params: Promise<{ level: string }>;
}) {
  const { level } = await params;
  if (!isKanjiLevel(level)) notFound();
  const { kanji, have } = await kanjiLevel(await getUserDb(), level);
  return <LibraryKanjiLevelView level={level} kanji={kanji} have={[...have]} />;
}
