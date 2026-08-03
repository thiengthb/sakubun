import { LiveRefresh } from '@/components/shell/live-refresh';
import { LibraryView } from '@/components/library/library-view';
import { GRAMMAR_KIND, listPublicLibrary, VOCAB_KIND } from '@/lib/library';
import { getSettings } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';
import { furiganaInApp } from '@/lib/settings-schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thư viện — sakubun' };

// The public library: others' shared items (content only). Two guard-safe raw-SQL reads (grammar +
// vocab), plus settings for the play-button audio. `live-refresh` catches items others publish.
export default async function LibraryPage() {
  const userId = await getSessionUserId();
  const [grammar, vocab, settings] = await Promise.all([
    listPublicLibrary(userId, { kind: GRAMMAR_KIND }),
    listPublicLibrary(userId, { kind: VOCAB_KIND }),
    getSettings(userId),
  ]);

  return (
    <>
      <LiveRefresh />
      <LibraryView
        grammar={grammar}
        vocab={vocab}
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        showFurigana={furiganaInApp(settings.furiganaMode)}
      />
    </>
  );
}
