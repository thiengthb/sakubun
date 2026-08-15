import { prisma } from '@/lib/db/db';
import { buildApkg, type VocabItem } from '@/lib/transfer/anki-apkg';
import { VOCAB_KIND } from '@/lib/library/practice';

export async function exportVocabApkg() {
  const items = await prisma.item.findMany({
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
