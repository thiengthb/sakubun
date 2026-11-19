import { LiveRefresh } from '@/components/layout/live-refresh';
import { OutsideView } from '@/components/features/resources/outside-view';
import { getUserDb } from '@/lib/auth/current-user';
import { loadOutsideShelves } from '@/lib/app/outside-shelves';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ngoài JLPT — sakubun' };

// "Ngoài JLPT" (U4e, docs/plans/2026-11-14-u4-kho.md), opened from the last card of Kho's level
// board: the learner's groups and the items outside JLPT by where they came from.
export default async function OutsidePage() {
  const db = await getUserDb();
  await ensureOpenJlptLibrary();
  const shelves = await loadOutsideShelves(db);
  return (
    <>
      <LiveRefresh />
      <OutsideView shelves={shelves} />
    </>
  );
}
