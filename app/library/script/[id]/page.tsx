import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LibraryScriptView } from '@/components/features/library/library-script-view';
import { getSessionAccess } from '@/lib/auth/current-user';
import { loginPath } from '@/lib/auth/login-return';
import { prisma } from '@/lib/db/db';
import { userDb } from '@/lib/db/user-db';
import { analyzeLines } from '@/lib/kaiwa/furigana';
import { parseScript } from '@/lib/kaiwa/parse';
import { japaneseTokenizer } from '@/lib/kaiwa/tokenizer';
import { likedEntries } from '@/lib/library/likes';
import { getSettings } from '@/lib/library/practice';
import { getScriptEntry, scriptCopies } from '@/lib/library/scripts';
import { DEFAULT_SETTINGS, furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// The link a learner sends a friend: its title in the preview, kept out of search results.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const entry = await getScriptEntry(prisma, (await params).id);
  return {
    title: entry ? `${entry.title} · Hội thoại trên Sakubun` : 'Sakubun',
    robots: { index: false, follow: false },
  };
}

// One shared Kaiwa script (K7b): read before taking it, with furigana worked out here, since a
// share keeps only the text. Anyone with the link reads it, signed in or not (thien, 2026-11-07);
// a guest gets no speech and no word lookup, and "Đăng nhập để lấy về" brings them back here.
export default async function LibraryScriptPage({ params }: Params) {
  const { id } = await params;
  const [entry, access] = await Promise.all([getScriptEntry(prisma, id), getSessionAccess()]);
  if (!entry) notFound();
  const db = access && access.access !== 'none' ? userDb(access.userId) : null;
  const [settings, liked, copies, tokenize] = await Promise.all([
    db ? getSettings(db) : DEFAULT_SETTINGS,
    db ? likedEntries(db, [entry.id]) : new Set<string>(),
    db ? scriptCopies(db, [entry]) : new Map<string, string>(),
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
      login={db ? null : loginPath(`/library/script/${entry.id}`)}
      admin={access?.access === 'admin'}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
