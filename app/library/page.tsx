import type { Metadata } from 'next';
import { LibraryView } from '@/components/features/library/library-view';
import { getUserDb } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/db';
import { getSettings } from '@/lib/library/practice';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';
import { browseEntries } from '@/lib/library/browse';
import { browseMeta, parseBrowseQuery } from '@/lib/library/browse-query';
import { listGroupEntries } from '@/lib/library/shared';
import { likedEntries } from '@/lib/library/likes';
import { groupProgress } from '@/lib/library/take';
import { furiganaInApp } from '@/lib/settings/schema';

export const metadata: Metadata = { title: 'Kho chung — sakubun' };
export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseBrowseQuery(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, one(v)])),
  );

  const db = await getUserDb();
  await ensureOpenJlptLibrary();
  const [groups, { rows, counts }, settings] = await Promise.all([
    listGroupEntries(prisma),
    browseEntries(db, query),
    getSettings(db),
  ]);
  const [liked, takenGroups, have] = await Promise.all([
    likedEntries(
      db,
      groups.map((g) => g.id),
    ),
    db.group.findMany({
      where: { libraryEntryId: { in: groups.map((g) => g.id) } },
      select: { id: true, libraryEntryId: true },
    }),
    groupProgress(
      db,
      groups.map((g) => g.id),
    ),
  ]);
  const myGroup = new Map(takenGroups.map((g) => [g.libraryEntryId, g.id]));
  const total = counts ? counts.GRAMMAR + counts.VOCAB : rows.length;

  return (
    <LibraryView
      groups={groups.map((g) => ({
        ...g,
        have: have.get(g.id) ?? 0,
        liked: liked.has(g.id),
        myGroupId: myGroup.get(g.id) ?? null,
      }))}
      entries={rows}
      entriesTotal={total}
      entriesMeta={counts ? browseMeta(counts, query) : `${total} mục`}
      search={query}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
