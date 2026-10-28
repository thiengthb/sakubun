import type { prisma } from '@/lib/db/db';
import type { StarterItem } from '@/lib/import/starter-deck';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { JLPT_LEVELS } from '@/lib/settings/schema';

// The shared library (kho chung, phase 8 L1): what anyone can read and take a copy of. Entries are
// snapshots, never a learner's live rows, so reading it touches no learning table. Every write to
// LibraryEntry goes through this module.

export type LibraryClient = Pick<
  typeof prisma,
  'libraryEntry' | 'libraryGroupMember' | '$transaction'
>;

export const GROUP_TYPE = 'GROUP';
export const OPENJLPT_ORIGIN = 'OPENJLPT';
export const LEARNER_ORIGIN = 'LEARNER';
export const PUBLIC = 'public';
// Taken down by its author (publish.ts), hidden by the admin (moderation.ts), or left by an account
// that was deleted: then it only still shows inside other learners' groups (plan rule 9).
export const HIDDEN = 'hidden';
export const REMOVED = 'removed';
export const ORPHAN = 'orphan';

// Whose entries show: OpenJLPT's and those of accounts not banned (L6). A banned author's entries come
// back by themselves when the ban is lifted.
const AUTHOR_SHOWN = {
  OR: [{ authorId: null }, { author: { OR: [{ banned: false }, { banned: null }] } }],
};
// An entry or group anyone can find and take. Under AND, so a query's own OR (searchEntries) adds to it.
export const VISIBLE = { status: PUBLIC, AND: [AUTHOR_SHOWN] };
// An entry inside a shared group: also one whose author's account was deleted, because whoever made
// the group chose it.
export const VISIBLE_MEMBER = { status: { in: [PUBLIC, ORPHAN] }, AND: [AUTHOR_SHOWN] };

const ITEM_TYPES = [GRAMMAR_KIND, VOCAB_KIND] as const;
type ItemType = (typeof ITEM_TYPES)[number];

export const openJlptKey = (type: string, expression: string) => `openjlpt:${type}:${expression}`;
const openJlptGroupKey = (level: string, type: ItemType) => `openjlpt:group:${level}:${type}`;

const GROUP_KIND_OF: Record<ItemType, 'grammar' | 'vocab'> = {
  [GRAMMAR_KIND]: 'grammar',
  [VOCAB_KIND]: 'vocab',
};

// The ready-made groups OpenJLPT seeds, one per level and kind ("N5 · Ngữ pháp"), so a new learner
// takes a whole level in one go. Pure: the deck in, the entries and their groups out.
export function openJlptGroups(deck: readonly StarterItem[]) {
  return JLPT_LEVELS.flatMap((level) =>
    ITEM_TYPES.map((type) => {
      const kind = GROUP_KIND_OF[type];
      return {
        sourceKey: openJlptGroupKey(level, type),
        name: `${level} · ${GROUP_KIND_LABELS[kind]}`,
        groupKind: kind,
        level,
        notes: `Toàn bộ ${GROUP_KIND_LABELS[kind].toLowerCase()} ${level} của OpenJLPT.`,
        members: deck
          .filter((i) => i.kind === type && i.level === level)
          .map((i) => openJlptKey(i.kind, i.expression)),
      };
    }),
  ).filter((g) => g.members.length > 0);
}

const CHUNK = 500;

// Puts OpenJLPT into the shared library: each pattern and word as an entry with no author, and the
// level groups. Safe to run again: entries already there (by sourceKey) are kept as they are, and a
// group only gains the members it lacks. Returns how many entries were added.
export async function seedOpenJlpt(
  db: LibraryClient,
  deck: readonly StarterItem[],
): Promise<{ entries: number; groups: number }> {
  const have = new Set(
    (
      await db.libraryEntry.findMany({
        where: { origin: OPENJLPT_ORIGIN },
        select: { sourceKey: true },
      })
    ).map((e) => e.sourceKey),
  );
  const newItems = deck
    .filter((i) => !have.has(openJlptKey(i.kind, i.expression)))
    .map((i) => ({
      type: i.kind,
      expression: i.expression,
      reading: i.reading,
      hanviet: i.hanviet,
      meaningVi: i.meaningVi,
      level: i.level,
      notes: i.notes || null,
      origin: OPENJLPT_ORIGIN,
      sourceKey: openJlptKey(i.kind, i.expression),
    }));
  const groups = openJlptGroups(deck);
  const newGroups = groups.filter((g) => !have.has(g.sourceKey));

  await db.$transaction(
    async (tx) => {
      for (let at = 0; at < newItems.length; at += CHUNK) {
        await tx.libraryEntry.createMany({ data: newItems.slice(at, at + CHUNK) });
      }
      await tx.libraryEntry.createMany({
        data: newGroups.map((g) => ({
          type: GROUP_TYPE,
          name: g.name,
          groupKind: g.groupKind,
          level: g.level,
          notes: g.notes,
          origin: OPENJLPT_ORIGIN,
          sourceKey: g.sourceKey,
        })),
      });

      const ids = new Map(
        (
          await tx.libraryEntry.findMany({
            where: { origin: OPENJLPT_ORIGIN },
            select: { id: true, sourceKey: true },
          })
        ).map((e) => [e.sourceKey, e.id]),
      );
      for (const group of groups) {
        const groupEntryId = ids.get(group.sourceKey)!;
        const members = await tx.libraryGroupMember.findMany({
          where: { groupEntryId },
          select: { itemEntryId: true, position: true },
        });
        const inGroup = new Set(members.map((m) => m.itemEntryId));
        let position = members.reduce((n, m) => Math.max(n, m.position + 1), 0);
        const rows = group.members
          .map((key) => ids.get(key)!)
          .filter((id) => !inGroup.has(id))
          .map((itemEntryId) => ({ groupEntryId, itemEntryId, position: position++ }));
        for (let at = 0; at < rows.length; at += CHUNK) {
          await tx.libraryGroupMember.createMany({ data: rows.slice(at, at + CHUNK) });
        }
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
  return { entries: newItems.length, groups: newGroups.length };
}

const ENTRY_FIELDS = {
  id: true,
  type: true,
  expression: true,
  reading: true,
  hanviet: true,
  meaningVi: true,
  level: true,
  notes: true,
  origin: true,
  authorId: true,
  basedOnId: true,
  takeCount: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { likes: true } },
} as const;

export interface SearchQuery {
  text?: string;
  type?: ItemType;
  level?: string;
  take?: number;
  skip?: number;
}

export const MAX_RESULTS = 50;

// Patterns and words matching a search, public only. The same expression may be shared many times
// (rule 7): OpenJLPT's version comes first as the original, then the most taken, then the most liked.
export async function searchEntries(db: LibraryClient, query: SearchQuery = {}) {
  const text = query.text?.trim();
  return db.libraryEntry.findMany({
    where: {
      ...VISIBLE,
      type: query.type ?? { in: [...ITEM_TYPES] },
      ...(query.level ? { level: query.level } : {}),
      ...(text
        ? {
            OR: [
              { expression: { contains: text } },
              { reading: { contains: text } },
              { meaningVi: { contains: text } },
            ],
          }
        : {}),
    },
    select: ENTRY_FIELDS,
    // OPENJLPT sorts after LEARNER, so descending puts the originals first.
    orderBy: [
      { origin: 'desc' },
      { takeCount: 'desc' },
      { likes: { _count: 'desc' } },
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
    take: Math.min(query.take ?? MAX_RESULTS, MAX_RESULTS),
    skip: query.skip ?? 0,
  });
}

// Shared groups, public only: OpenJLPT's level groups first, in level order, then the learners' groups,
// the most taken first and then the newest (7.4h). `author` is the name of the learner who shared it.
export async function listGroupEntries(db: LibraryClient, { level }: { level?: string } = {}) {
  const groups = await db.libraryEntry.findMany({
    where: { type: GROUP_TYPE, ...VISIBLE, ...(level ? { level } : {}) },
    select: {
      id: true,
      name: true,
      groupKind: true,
      level: true,
      notes: true,
      origin: true,
      authorId: true,
      author: { select: { name: true } },
      takeCount: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { members: { where: { item: VISIBLE_MEMBER } }, likes: true } },
    },
    orderBy: [{ origin: 'desc' }, { takeCount: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  const rank = (level: string | null) => {
    const at = JLPT_LEVELS.indexOf(level as (typeof JLPT_LEVELS)[number]);
    return at < 0 ? JLPT_LEVELS.length : at;
  };
  return groups
    .map(({ _count, author, ...g }) => ({
      ...g,
      author: author?.name ?? null,
      size: _count.members,
      likes: _count.likes,
    }))
    .sort(
      (a, b) =>
        Number(b.origin === OPENJLPT_ORIGIN) - Number(a.origin === OPENJLPT_ORIGIN) ||
        (a.origin === OPENJLPT_ORIGIN
          ? rank(a.level) - rank(b.level)
          : b.takeCount - a.takeCount || b.createdAt.getTime() - a.createdAt.getTime()),
    );
}

// One public group with its public entries in order; null when it is not shared (any more).
export async function getGroupEntry(db: LibraryClient, id: string) {
  const group = await db.libraryEntry.findFirst({
    where: { id, type: GROUP_TYPE, ...VISIBLE },
    select: {
      id: true,
      name: true,
      groupKind: true,
      level: true,
      notes: true,
      origin: true,
      authorId: true,
      author: { select: { name: true } },
      takeCount: true,
      updatedAt: true,
      _count: { select: { likes: true } },
    },
  });
  if (!group) return null;
  const members = await db.libraryGroupMember.findMany({
    where: { groupEntryId: id, item: VISIBLE_MEMBER },
    orderBy: { position: 'asc' },
    select: { item: { select: ENTRY_FIELDS } },
  });
  const { author, ...rest } = group;
  return { ...rest, author: author?.name ?? null, entries: members.map((m) => m.item) };
}

// One of OpenJLPT's level groups ("N5 · Ngữ pháp"), where a new learner starts (L4).
export function findOpenJlptGroup(db: LibraryClient, level: string, type: ItemType) {
  return db.libraryEntry.findFirst({
    where: { sourceKey: openJlptGroupKey(level, type), status: PUBLIC },
    select: { id: true, name: true },
  });
}
