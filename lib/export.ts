// The LEARNING-DATA export: a portable JSON copy of what the learner built, readable and diffable, that
// syncs back in through lib/import.ts (merge by id, never delete). Shape is plain JSON, so dates
// serialize to ISO.
//
// It is deliberately NOT the whole database — app/api/backup is (a SQLite snapshot, and the only
// complete one). Left out on purpose: the auth tables (login, MCP keys — a credential does not belong in
// a file you copy to a cloud drive) and the tutor's own working state (LearnerNote, LearnerAbility,
// CalibrationProposal — derived from the review history that IS here). The settings Data tab says both
// of these out loud; if this list changes, that copy changes with it.
//
// Single user (2026-08-05): the queries used to be scoped by `userId` against a fail-closed tenancy
// guard. Both are gone with multi-user — the learning tables have no owner column, and the boundary is
// now "signed in at all" (the route checks the session; see AGENTS.md).

import { prisma } from '@/lib/db';
import { buildApkg, type VocabItem } from '@/lib/anki-apkg';
import { VOCAB_KIND } from '@/lib/practice';

/**
 * The saved vocabulary, packaged as an Anki deck (.apkg) the learner imports into their own Anki.
 *
 * Replaces the old AnkiConnect push (removed 2026-07-23): that ran server-side, so it could only ever
 * reach the Anki running on the container's host — which is not where the learner's Anki is. A
 * downloaded file has no such coupling.
 */
export async function exportVocabApkg() {
  const items = await prisma.item.findMany({
    where: { kind: VOCAB_KIND },
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

/**
 * The whole learning-data dump. Field names + row shapes ARE the file format — `accountBackupSchema`
 * (lib/import-schema.ts) parses exactly this, so a field added here needs its counterpart there or it is
 * silently dropped on the way back in.
 *
 * `groups`/`groupMembers` were missing between the single-user strip and 2026-08-05: study groups came
 * back (commit f992bdf) but this export did not, so every JSON backup taken in that window silently
 * carries no groups. The importer says so rather than guessing (see lib/import.ts).
 */
export async function exportUserData() {
  const [items, srsStates, reviewLogs, sentences, settings, groups, groupMembers] =
    await Promise.all([
      prisma.item.findMany({}),
      prisma.srsState.findMany({}),
      prisma.reviewLog.findMany({}),
      prisma.sentence.findMany({}),
      prisma.settings.findFirst({}),
      prisma.group.findMany({}),
      prisma.groupMember.findMany({}),
    ]);

  return {
    exportedAt: new Date().toISOString(),
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
