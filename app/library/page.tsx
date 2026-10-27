import type { Metadata } from 'next';
import { LibraryView } from '@/components/features/library/library-view';
import { getUserDb } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/db';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { getSettings } from '@/lib/library/practice';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';
import { listGroupEntries, searchEntries } from '@/lib/library/shared';
import { ownedItems } from '@/lib/library/take';
import { furiganaInApp, JLPT_LEVELS } from '@/lib/settings/schema';

export const metadata: Metadata = { title: 'Kho chung — sakubun' };
export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = one(params.q)?.trim() ?? '';
  const typeParam = one(params.type);
  const type = typeParam === GRAMMAR_KIND || typeParam === VOCAB_KIND ? typeParam : undefined;
  const levelParam = one(params.level);
  const level = JLPT_LEVELS.find((l) => l === levelParam);

  const db = await getUserDb();
  await ensureOpenJlptLibrary();
  const [groups, entries, settings] = await Promise.all([
    listGroupEntries(prisma),
    searchEntries(prisma, { text: q, type, level }),
    getSettings(db),
  ]);
  const [owned, takenGroups] = await Promise.all([
    ownedItems(db, entries),
    db.group.findMany({
      where: { libraryEntryId: { in: groups.map((g) => g.id) } },
      select: { id: true, libraryEntryId: true },
    }),
  ]);
  const myGroup = new Map(takenGroups.map((g) => [g.libraryEntryId, g.id]));

  return (
    <LibraryView
      groups={groups.map((g) => ({ ...g, myGroupId: myGroup.get(g.id) ?? null }))}
      entries={entries.map((e) => ({ ...e, itemId: owned.get(e.id) ?? null }))}
      search={{ q, type: type ?? 'all', level: level ?? 'all' }}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
