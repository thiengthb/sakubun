import type { UserDb } from '@/lib/db/user-db';
import { buildApkg, type VocabItem } from '@/lib/transfer/anki-apkg';
import { VOCAB_KIND } from '@/lib/library/practice';

export async function exportVocabApkg(db: UserDb) {
  const items = await db.item.findMany({
    where: { kind: VOCAB_KIND },
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
    key: i.id,
    word: i.expression,
    reading: i.reading ?? undefined,
    sinoVietnamese: i.hanviet ?? undefined,
    meaning: i.meaningVi,
    example: i.notes ?? undefined,
  }));

  return { count: vocab.length, bytes: buildApkg(vocab) };
}

export async function exportUserData(db: UserDb) {
  const [items, srsStates, reviewLogs, sentences, turns, settings, groups, groupMembers] =
    await Promise.all([
      db.item.findMany({}),
      db.srsState.findMany({}),
      db.reviewLog.findMany({}),
      db.sentence.findMany({}),
      db.turn.findMany({}),
      db.settings.findFirst({}),
      db.group.findMany({}),
      db.groupMember.findMany({}),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    counts: {
      items: items.length,
      reviewLogs: reviewLogs.length,
      sentences: sentences.length,
      turns: turns.length,
      groups: groups.length,
    },
    items,
    srsStates,
    reviewLogs,
    sentences,
    turns,
    settings,
    groups,
    groupMembers,
  };
}
