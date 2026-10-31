import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KaiwaChat } from '@/components/features/kaiwa/kaiwa-chat';
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

export const metadata: Metadata = { title: 'Kho chung — sakubun' };
export const dynamic = 'force-dynamic';

// The furigana of a shared script, worked out as it is read (a share stores only its text). A
// tokenizer that fails to load leaves the author's own readings.
async function rubyOf(body: string) {
  const lines = parseScript(body);
  try {
    const analysis = analyzeLines(lines, await japaneseTokenizer());
    return lines.map((line, i) => ({ ...line, ruby: analysis.lines[i]?.ruby ?? line.japanese }));
  } catch (error) {
    console.error('[library] script furigana failed', error);
    return lines.map((line) => ({ ...line, ruby: line.japanese }));
  }
}

export default async function LibraryScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const admin = (await getSessionAccess())?.access === 'admin';
  const [entry, settings] = await Promise.all([getScriptEntry(prisma, id), getSettings(db)]);
  if (!entry) notFound();
  const [lines, copies, liked] = await Promise.all([
    rubyOf(entry.body),
    scriptCopies(db, [entry]),
    likedEntries(db, [entry.id]),
  ]);

  return (
    <LibraryScriptView
      script={{
        id: entry.id,
        title: entry.title,
        speakers: entry.speakers,
        lineCount: entry.lineCount,
        author: entry.author,
        takeCount: entry.takeCount,
        likes: entry.likes,
        liked: liked.has(entry.id),
        myScriptId: copies.get(entry.id) ?? null,
      }}
      admin={admin}
    >
      <KaiwaChat
        scriptId={`library:${entry.id}`}
        lines={lines}
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        showFurigana={furiganaInApp(settings.furiganaMode)}
      />
    </LibraryScriptView>
  );
}
