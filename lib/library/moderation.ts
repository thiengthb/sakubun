import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { ORPHAN, PUBLIC, REMOVED, type LibraryClient } from '@/lib/library/shared';

// Keeping Kho chung clean (phase 8, L6; plan rule 9). Only admin pages and actions call this. A banned
// author's entries need nothing here: every read leaves them out (VISIBLE in shared.ts) for as long
// as the ban lasts.

type Db = Pick<LibraryClient, 'libraryEntry'>;

// Hides one entry or group (or shows it again). Only what is public, or was hidden this way, moves:
// an author's own take-down stays theirs to undo.
export async function setEntryRemoved(
  db: Db,
  entryId: string,
  removed: boolean,
): Promise<ActionResult<{ status: string }>> {
  const res = await db.libraryEntry.updateMany({
    where: removed
      ? { id: entryId, status: { in: [PUBLIC, ORPHAN] } }
      : { id: entryId, status: REMOVED },
    data: { status: removed ? REMOVED : PUBLIC },
  });
  if (res.count === 0)
    return err(
      removed ? 'Mục này không còn hiện trên Kho chung.' : 'Mục này không bị quản trị ẩn.',
    );
  return ok({ status: removed ? REMOVED : PUBLIC });
}

// Before an account is deleted: what it shared leaves Kho chung, but stays inside other learners'
// groups, which chose it (rule 9). The foreign key then drops the author.
export async function orphanAuthorEntries(db: Db, userId: string): Promise<number> {
  const res = await db.libraryEntry.updateMany({
    where: { authorId: userId, status: PUBLIC },
    data: { status: ORPHAN },
  });
  return res.count;
}

// Everything an account has shared, whatever its status, for its admin page.
export function listAuthorEntries(db: Db, userId: string) {
  return db.libraryEntry.findMany({
    where: { authorId: userId },
    select: {
      id: true,
      type: true,
      expression: true,
      name: true,
      meaningVi: true,
      level: true,
      status: true,
      takeCount: true,
      createdAt: true,
      _count: { select: { likes: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
}
