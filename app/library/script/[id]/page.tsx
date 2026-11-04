import { notFound } from 'next/navigation';
import { LibraryScriptView } from '@/components/features/library/library-script-view';
import { getSessionAccess, getUserDb } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/db';
import { analyzeLines } from '@/lib/kaiwa/furigana';
import { parseScript } from '@/lib/kaiwa/parse';
import { japaneseTokenizer } from '@/lib/kaiwa/tokenizer';
import { likedEntries } from '@/lib/library/likes';
import { getSettings } from '@/lib/library/practice';
import { getScriptEntry, scriptCopies } from '@/lib/library/scripts';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

// One shared Kaiwa script (K7b): read before taking it, with furigana worked out here, since a
// share keeps only the text.
export default async function LibraryScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const [entry, settings, access] = await Promise.all([
    getScriptEntry(prisma, id),
    getSettings(db),
    getSessionAccess(),
  ]);
  if (!entry) notFound();
  const [liked, copies, tokenize] = await Promise.all([
    likedEntries(db, [entry.id]),
    scriptCopies(db, [entry]),
    japaneseTokenizer(),
  ]);
  const lines = parseScript(entry.body);
  const analysis = analyzeLines(lines, tokenize);

  return (
    <LibraryScriptView
      script={{
        id: entry.id,
        title: entry.title,
        author: entry.author,
        takeCount: entry.takeCount,
        speakers: entry.speakers,
        likes: entry.likes,
        liked: liked.has(entry.id),
        myScriptId: copies.get(entry.id) ?? null,
        lines: lines.map((line, i) => ({ ...line, ruby: analysis.lines[i].ruby })),
      }}
      admin={access?.access === 'admin'}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
