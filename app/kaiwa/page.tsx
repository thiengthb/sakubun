import { KaiwaListView } from '@/components/features/kaiwa/kaiwa-list-view';
import { getUserDb } from '@/lib/auth/current-user';
import { listScriptCards } from '@/lib/kaiwa/scripts';
import { scriptLibraryMarks } from '@/lib/library/scripts';

export const dynamic = 'force-dynamic';

export default async function KaiwaPage() {
  const db = await getUserDb();
  const [scripts, marks] = await Promise.all([listScriptCards(db), scriptLibraryMarks(db)]);
  return (
    <KaiwaListView
      scripts={scripts.map((s) => ({
        ...s,
        sharedEntryId: marks.get(s.id)?.sharedEntryId ?? null,
        taken: marks.get(s.id)?.taken ?? false,
      }))}
    />
  );
}
