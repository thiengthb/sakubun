import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { PUBLIC } from '@/lib/library/shared';

// "Thích" on the shared library (phase 8, L3; plan rule 7): one like per learner and entry, which
// ranks entries after OpenJLPT's originals and the take count.

export async function setLike(
  db: UserDb,
  entryId: string,
  liked: boolean,
): Promise<ActionResult<{ liked: boolean; likes: number }>> {
  const entry = await db.libraryEntry.findFirst({
    where: { id: entryId, status: PUBLIC },
    select: { id: true },
  });
  if (!entry) return err('Mục này không còn trên kho chung.');
  const userId = db.$ownerId();
  if (liked)
    await db.libraryLike.upsert({
      where: { entryId_userId: { entryId, userId } },
      create: { entryId, userId },
      update: {},
    });
  else await db.libraryLike.deleteMany({ where: { entryId, userId } });
  return ok({ liked, likes: await db.libraryLike.count({ where: { entryId } }) });
}

// Which of these entries the learner likes.
export async function likedEntries(db: UserDb, entryIds: readonly string[]): Promise<Set<string>> {
  const rows = await db.libraryLike.findMany({
    where: { userId: db.$ownerId(), entryId: { in: [...entryIds] } },
    select: { entryId: true },
  });
  return new Set(rows.map((r) => r.entryId));
}
