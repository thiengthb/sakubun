import { redirect } from 'next/navigation';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { LevelBoardView } from '@/components/features/resources/level-board-view';
import { getUserDb } from '@/lib/auth/current-user';
import { levelBoard } from '@/lib/app/level-board';
import { getSettings } from '@/lib/library/practice';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';

export const dynamic = 'force-dynamic';

// Kho (U4b, docs/plans/2026-11-14-u4-kho.md): the JLPT level board. A link that names a tab or a
// card (?tab=vocab, ?card=needs-work) was written for the list of every item, which now lives at
// /resources/all.
export default async function KhoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.tab !== undefined || params.card !== undefined) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      for (const v of [value ?? []].flat()) query.append(key, v);
    redirect(`/resources/all?${query}`);
  }
  const db = await getUserDb();
  await ensureOpenJlptLibrary();
  const [board, settings] = await Promise.all([levelBoard(db), getSettings(db)]);
  return (
    <>
      <LiveRefresh />
      <LevelBoardView
        board={board}
        grammarLevel={settings.grammarLevel}
        vocabLevel={settings.vocabLevel}
      />
    </>
  );
}
