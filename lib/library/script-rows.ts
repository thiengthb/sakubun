import type { UserDb } from '@/lib/db/user-db';
import { likedEntries } from '@/lib/library/likes';
import { listScriptEntries, scriptCopies } from '@/lib/library/scripts';

// One shared script as Kho chung's "Kịch bản" tab draws it (K7b): what the card says, and what this
// learner has done with it (liked it, has a copy in Hội thoại).
export interface LibraryScriptRow {
  id: string;
  title: string;
  firstLine: string;
  lineCount: number;
  speakers: string[];
  author: string | null;
  takeCount: number;
  likes: number;
  liked: boolean;
  // The learner's own script: the copy they took, or the script they shared it from.
  myScriptId: string | null;
}

export async function libraryScriptRows(db: UserDb, text?: string): Promise<LibraryScriptRow[]> {
  const rows = await listScriptEntries(db, { text });
  const [liked, copies] = await Promise.all([
    likedEntries(
      db,
      rows.map((r) => r.id),
    ),
    scriptCopies(db, rows),
  ]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    firstLine: r.firstLine,
    lineCount: r.lineCount,
    speakers: r.speakers,
    author: r.author,
    takeCount: r.takeCount,
    likes: r.likes,
    liked: liked.has(r.id),
    myScriptId: copies.get(r.id) ?? null,
  }));
}
