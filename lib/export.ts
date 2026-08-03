// Per-user data export (multi-user, 2026-07-22). A normal member cannot download the whole-DB backup
// (that is admin-only and spans every member — app/api/backup), but they own their data and must be
// able to take a copy out. This returns ONLY the signed-in user's own rows, every query scoped by
// `userId` so it passes the fail-closed tenancy guard in lib/db.ts — a member can never export another
// member's data. Shape is plain JSON (dates serialize to ISO); it is a portable dump, not a restore
// format (restore is still an operator-level, whole-volume operation).

import { prisma } from '@/lib/db';
import { buildApkg, type VocabItem } from '@/lib/anki-apkg';
import { VOCAB_KIND } from '@/lib/practice';

/**
 * The member's saved vocabulary, packaged as an Anki deck (.apkg) they import into THEIR OWN Anki.
 *
 * Replaces the old AnkiConnect push (removed 2026-07-23): that ran server-side and could only reach
 * the Anki on the container's host, so on a multi-user deploy it was never the member's own Anki. A
 * downloaded file has no such coupling. Scoped by `userId` like every other export here.
 */
export async function exportVocabApkg(userId: string) {
  const items = await prisma.item.findMany({
    where: { userId, kind: VOCAB_KIND },
    // `notes` holds the example sentence for a VOCAB item (add_vocab maps `example` -> notes).
    select: {
      id: true,
      expression: true,
      reading: true,
      hanviet: true,
      meaningVi: true,
      notes: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const vocab: VocabItem[] = items.map((i) => ({
    // The Item id becomes the note guid, so re-importing a later export UPDATES these notes.
    key: i.id,
    word: i.expression,
    reading: i.reading ?? undefined,
    sinoVietnamese: i.hanviet ?? undefined,
    meaning: i.meaningVi,
    example: i.notes ?? undefined,
  }));

  return { count: vocab.length, bytes: buildApkg(vocab) };
}

export async function exportUserData(userId: string) {
  const [items, srsStates, reviewLogs, sentences, settings, groups, groupMembers] =
    await Promise.all([
      prisma.item.findMany({ where: { userId } }),
      prisma.srsState.findMany({ where: { userId } }),
      prisma.reviewLog.findMany({ where: { userId } }),
      prisma.sentence.findMany({ where: { userId } }),
      prisma.settings.findFirst({ where: { userId } }),
      prisma.group.findMany({ where: { userId } }),
      prisma.groupMember.findMany({ where: { userId } }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    userId,
    counts: {
      items: items.length,
      reviewLogs: reviewLogs.length,
      sentences: sentences.length,
      groups: groups.length,
    },
    items,
    srsStates,
    reviewLogs,
    sentences,
    settings,
    groups,
    groupMembers,
  };
}
