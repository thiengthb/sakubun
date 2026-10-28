import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LibraryItemView } from '@/components/features/library/library-item-view';
import { openJlptExample, openJlptExamples } from '@/lib/app/openjlpt-examples';
import { getSessionAccess, getUserDb } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/db';
import { getSettings } from '@/lib/library/practice';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';
import { getItemEntry } from '@/lib/library/shared';
import { likedEntries } from '@/lib/library/likes';
import { ownedItems } from '@/lib/library/take';
import { furiganaInApp } from '@/lib/settings/schema';

export const metadata: Metadata = { title: 'Kho chung — sakubun' };
export const dynamic = 'force-dynamic';

export default async function LibraryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const admin = (await getSessionAccess())?.access === 'admin';
  await ensureOpenJlptLibrary();
  const [entry, settings, examples] = await Promise.all([
    getItemEntry(prisma, id),
    getSettings(db),
    openJlptExamples(),
  ]);
  if (!entry?.expression) notFound();
  const [owned, liked] = await Promise.all([ownedItems(db, [entry]), likedEntries(db, [entry.id])]);
  // A sentence OpenJLPT marks as unfit to learn from is not shown (skip).
  const found = openJlptExample(examples, entry.type, entry.expression);
  const openJlpt = found && !found.skip ? found : null;

  return (
    <LibraryItemView
      entry={{
        id: entry.id,
        type: entry.type,
        expression: entry.expression,
        reading: entry.reading,
        hanviet: entry.hanviet,
        meaningVi: entry.meaningVi,
        level: entry.level,
        origin: entry.origin,
        author: entry.author,
        takeCount: entry.takeCount,
        likes: entry.likes,
        liked: liked.has(entry.id),
        groups: entry.groups,
        itemId: owned.get(entry.id) ?? null,
        formationVi: openJlpt?.formationVi ?? null,
        example: openJlpt?.example ?? null,
      }}
      admin={admin}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
