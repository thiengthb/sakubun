import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { OutsideList } from '@/components/features/resources/outside-list';
import { getUserDb } from '@/lib/auth/current-user';
import { loadOutsideItems } from '@/lib/app/outside-shelves';
import { getSettings } from '@/lib/library/practice';
import { parseOutsideSource, SOURCE_TITLE } from '@/lib/library/outside-shelves';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';

export const dynamic = 'force-dynamic';

type Params = Promise<{ source: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const source = parseOutsideSource((await params).source);
  return { title: `${source ? SOURCE_TITLE[source] : 'Ngoài JLPT'} — sakubun` };
}

// One source of "Ngoài JLPT" (U4e): Claude soạn, Tự viết or Từ bộ chia sẻ.
export default async function OutsideSourcePage({ params }: { params: Params }) {
  const source = parseOutsideSource((await params).source);
  if (!source) notFound();
  const db = await getUserDb();
  await ensureOpenJlptLibrary();
  const [items, settings] = await Promise.all([loadOutsideItems(db, source), getSettings(db)]);
  return (
    <>
      <LiveRefresh />
      <OutsideList
        source={source}
        items={items}
        now={new Date()}
        tts={{ speaker: settings.voiceSpeaker, rate: settings.speechRate }}
      />
    </>
  );
}
