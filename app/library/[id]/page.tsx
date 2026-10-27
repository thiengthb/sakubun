import { notFound } from 'next/navigation';
import { LibraryGroupView } from '@/components/features/library/library-group-view';
import { getSessionAccess, getUserDb } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/db';
import { getSettings } from '@/lib/library/practice';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';
import { getGroupEntry } from '@/lib/library/shared';
import { likedEntries } from '@/lib/library/likes';
import { ownedItems } from '@/lib/library/take';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export default async function LibraryGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const admin = (await getSessionAccess())?.access === 'admin';
  await ensureOpenJlptLibrary();
  const [group, settings, mine] = await Promise.all([
    getGroupEntry(prisma, id),
    getSettings(db),
    db.group.findFirst({ where: { libraryEntryId: id }, select: { id: true } }),
  ]);
  if (!group) notFound();
  const [owned, liked] = await Promise.all([
    ownedItems(db, group.entries),
    likedEntries(db, [group.id, ...group.entries.map((e) => e.id)]),
  ]);

  return (
    <LibraryGroupView
      group={{
        id: group.id,
        name: group.name ?? '',
        groupKind: group.groupKind,
        notes: group.notes,
        origin: group.origin,
        takeCount: group.takeCount,
        likes: group._count.likes,
        liked: liked.has(group.id),
        myGroupId: mine?.id ?? null,
      }}
      entries={group.entries.map(({ _count, ...e }) => ({
        ...e,
        likes: _count.likes,
        liked: liked.has(e.id),
        itemId: owned.get(e.id) ?? null,
      }))}
      admin={admin}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
