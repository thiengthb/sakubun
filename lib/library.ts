// Public library + fork (Phase 3, plan 2026-07-21 / 2026-07-22). Publishing shares ONLY an Item's
// CONTENT (expression/reading/meaning/notes/enrichment) across users; the owner's SrsState/ReviewLog
// are NEVER exposed. The cross-tenant reads (list/get) are RAW SQL that select content columns only,
// so the fail-closed tenancy guard in lib/db.ts stays intact — a Prisma query on Item still requires a
// userId, and it is structurally impossible for these reads to leak a schedule or review history.
// publish/unpublish/fork go through guarded Prisma (they are scoped to a concrete userId).

import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { Prisma } from '@/lib/generated/prisma/client';
import { newSrsFields } from '@/lib/srs';
import { cleanTextOrNull } from '@/lib/text';

const GRAMMAR_KIND = 'GRAMMAR';
const VOCAB_KIND = 'VOCAB';

export interface LibraryEntry {
  id: string;
  kind: string;
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string;
  level: string;
  notes: string | null;
  hasEnrichment: boolean;
  /** Full enrichment payload — eager-loaded so the /library detail modal reuses <ItemDetailDialog>. */
  enrichment: string | null;
  ownerName: string;
  /** Owner's account photo (e.g. Google) so the "Người chia sẻ" cell matches the sidebar avatar. */
  ownerImage: string | null;
  forkCount: number;
  /** The current user already has this (kind, expression) — forking again would be a duplicate. */
  alreadyMine: boolean;
  /** This row IS one of the current user's OWN shared items — shown so they can see what they published. */
  isMine: boolean;
  /** Public like/upvote (Phase 5): total likes + whether the viewer has liked it. */
  likeCount: number;
  likedByMe: boolean;
}

export interface ListLibraryFilter {
  kind?: string;
  search?: string;
  limit?: number;
}

// Shape returned by the raw list query (SQLite hands booleans/counts back as 0/1 / number|bigint).
interface LibraryRow {
  id: string;
  kind: string;
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string;
  level: string;
  notes: string | null;
  hasEnrichment: number;
  enrichment: string | null;
  ownerName: string;
  ownerImage: string | null;
  forkCount: number | bigint;
  mineCount: number | bigint;
  isMine: number;
  likeCount: number | bigint;
  likedByMe: number | bigint;
}

/**
 * All PUBLIC items, content only — INCLUDING the current user's own shared items (flagged `isMine`) so
 * they can see what they published (they just can't fork their own). Raw SQL so the guard is bypassed
 * deliberately for this one cross-tenant read; the SELECT lists content columns explicitly, so
 * SrsState/ReviewLog can never ride along. `alreadyMine` flags items you already own by
 * (kind, expression) so the UI can disable the fork.
 */
export async function listPublicLibrary(
  userId: string,
  filter: ListLibraryFilter = {},
): Promise<LibraryEntry[]> {
  // The library page fetches the WHOLE public set and paginates client-side (like every DataTable
  // surface), so the ceiling must clear the real catalog size, not cut it to 200. Kept as a sane
  // safety cap; once the shared library grows into the thousands, switch to server-side pagination
  // (noted in docs/decisions.md 2026-07-24).
  const limit = Math.min(Math.max(filter.limit ?? 5000, 1), 5000);
  const conds: Prisma.Sql[] = [Prisma.sql`i.visibility = 'public'`];
  if (filter.kind) conds.push(Prisma.sql`i.kind = ${filter.kind}`);
  const search = filter.search?.trim();
  if (search) {
    const like = `%${search}%`;
    conds.push(
      Prisma.sql`(i.expression LIKE ${like} OR i.reading LIKE ${like} OR i.meaningVi LIKE ${like})`,
    );
  }
  const where = Prisma.join(conds, ' AND ');

  // Counts come from THREE pre-aggregated LEFT JOINs, not four correlated subqueries per row: the old
  // form ran ~4×N sub-selects (15k+ at 5000 rows). Each join groups once, then attaches by key — same
  // numbers, a fraction of the work. `likeCount` + `likedByMe` share one ItemLike aggregate.
  const rows = await prisma.$queryRaw<LibraryRow[]>`
    SELECT i.id, i.kind, i.expression, i.reading, i.hanviet, i.meaningVi, i.level, i.notes,
           (i.enrichment IS NOT NULL) AS hasEnrichment, i.enrichment,
           u.name AS ownerName, u.image AS ownerImage,
           (i.userId = ${userId}) AS isMine,
           COALESCE(fk.c, 0) AS forkCount,
           COALESCE(lk.c, 0) AS likeCount,
           COALESCE(lk.mine, 0) AS likedByMe,
           COALESCE(mine.c, 0) AS mineCount
    FROM "Item" i
    JOIN "user" u ON u.id = i.userId
    LEFT JOIN (
      SELECT "forkedFromId" AS fid, COUNT(*) AS c
      FROM "Item" WHERE "forkedFromId" IS NOT NULL GROUP BY "forkedFromId"
    ) fk ON fk.fid = i.id
    LEFT JOIN (
      SELECT "itemId" AS iid, COUNT(*) AS c,
             MAX(CASE WHEN "userId" = ${userId} THEN 1 ELSE 0 END) AS mine
      FROM "ItemLike" GROUP BY "itemId"
    ) lk ON lk.iid = i.id
    LEFT JOIN (
      SELECT kind AS mkind, expression AS mexpr, COUNT(*) AS c
      FROM "Item" WHERE "userId" = ${userId} GROUP BY kind, expression
    ) mine ON mine.mkind = i.kind AND mine.mexpr = i.expression
    WHERE ${where}
    ORDER BY i.createdAt DESC
    LIMIT ${limit}`;

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    expression: r.expression,
    reading: r.reading,
    hanviet: r.hanviet,
    meaningVi: r.meaningVi,
    level: r.level,
    notes: r.notes,
    hasEnrichment: Number(r.hasEnrichment) > 0,
    enrichment: r.enrichment,
    ownerName: r.ownerName,
    ownerImage: r.ownerImage,
    forkCount: Number(r.forkCount),
    alreadyMine: Number(r.mineCount) > 0,
    isMine: Number(r.isMine) > 0,
    likeCount: Number(r.likeCount),
    likedByMe: Number(r.likedByMe) > 0,
  }));
}

interface PublicItemRow {
  id: string;
  kind: string;
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string;
  level: string;
  notes: string | null;
  enrichment: string | null;
  ownerId: string;
  ownerName: string;
}

/** One PUBLIC item's content (any owner), or null. Raw SQL — content columns only, used as the fork source. */
export async function getPublicItem(id: string): Promise<PublicItemRow | null> {
  const rows = await prisma.$queryRaw<PublicItemRow[]>`
    SELECT i.id, i.kind, i.expression, i.reading, i.hanviet, i.meaningVi, i.level, i.notes, i.enrichment,
           i.userId AS ownerId, u.name AS ownerName
    FROM "Item" i
    JOIN "user" u ON u.id = i.userId
    WHERE i.id = ${id} AND i.visibility = 'public'
    LIMIT 1`;
  return rows[0] ?? null;
}

/** The visibility of one of the user's OWN items ("private" | "public"), or null if not theirs. Guard-safe. */
export async function getItemVisibility(userId: string, itemId: string): Promise<string | null> {
  const row = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: { visibility: true },
  });
  return row?.visibility ?? null;
}

/**
 * Publish one of the user's OWN items to the library. Returns false if it isn't theirs OR it is a fork.
 * `forkedFromId: null` is the authorship gate: you can only share an item YOU authored — a forked item's
 * content belongs to its original creator, so re-sharing it would misattribute their work. Guard-safe.
 */
export async function publishItem(userId: string, itemId: string): Promise<boolean> {
  const res = await prisma.item.updateMany({
    where: { id: itemId, userId, forkedFromId: null },
    data: { visibility: 'public' },
  });
  return res.count > 0;
}

/** Unpublish (back to private). Returns false if it isn't theirs. Guard-safe. */
export async function unpublishItem(userId: string, itemId: string): Promise<boolean> {
  const res = await prisma.item.updateMany({
    where: { id: itemId, userId },
    data: { visibility: 'private' },
  });
  return res.count > 0;
}

/**
 * Bulk publish the user's OWN, self-authored items (the resources selection bar). Same authorship gate
 * as publishItem: `forkedFromId: null` silently skips any forked rows in the selection, so `affected`
 * counts only the items that were actually shareable. Guard-safe (scoped to userId).
 */
export async function publishItems(userId: string, itemIds: string[]): Promise<number> {
  if (itemIds.length === 0) return 0;
  const res = await prisma.item.updateMany({
    where: { id: { in: itemIds }, userId, forkedFromId: null },
    data: { visibility: 'public' },
  });
  return res.count;
}

/** Bulk unpublish (back to private). Returns how many rows changed. Guard-safe. */
export async function unpublishItems(userId: string, itemIds: string[]): Promise<number> {
  if (itemIds.length === 0) return 0;
  const res = await prisma.item.updateMany({
    where: { id: { in: itemIds }, userId },
    data: { visibility: 'private' },
  });
  return res.count;
}

export type ForkResult =
  | { forked: true; itemId: string }
  | { forked: false; reason: 'not-found' | 'own-item' | 'already-have' };

/**
 * Copy a PUBLIC item's CONTENT into a NEW item owned by `userId`, with a FRESH FSRS schedule and a
 * `forkedFromId` provenance link. The taker's reviews never touch the source (a separate SrsState).
 * Dup-guarded: if the user already owns this (kind, expression), nothing is created. Content only —
 * the source's schedule/history are not read (getPublicItem selects content columns).
 */
export async function forkItem(userId: string, sourceItemId: string): Promise<ForkResult> {
  const src = await getPublicItem(sourceItemId);
  if (!src) return { forked: false, reason: 'not-found' };
  if (src.ownerId === userId) return { forked: false, reason: 'own-item' };

  // Guard-safe existence check (userId scoped): already own this (kind, expression)?
  const mine = await prisma.item.findFirst({
    where: { userId, kind: src.kind, expression: src.expression },
    select: { id: true },
  });
  if (mine) return { forked: false, reason: 'already-have' };

  const created = await prisma.item.create({
    data: {
      userId,
      kind: src.kind,
      expression: src.expression,
      reading: cleanTextOrNull(src.reading),
      hanviet: cleanTextOrNull(src.hanviet),
      meaningVi: src.meaningVi,
      level: src.level,
      notes: cleanTextOrNull(src.notes),
      enrichment: src.enrichment,
      enrichedAt: src.enrichment ? new Date() : null,
      source: 'MANUAL',
      visibility: 'private',
      forkedFromId: src.id,
      // Fresh FSRS card for the taker (denormalized userId — the guard + hot due-query need it).
      srs: { create: { ...newSrsFields(), userId } },
    },
    select: { id: true },
  });
  // Tell the ORIGINAL owner their shared card was taken. Passenger: a failure here must never turn a
  // successful fork into an error for the person taking it.
  try {
    const taker = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await notify(src.ownerId, {
      kind: 'ITEM_FORKED',
      title: `${taker?.name ?? 'Một thành viên'} đã lấy 「${src.expression}」 về kho`,
      pluralTitle: (n) => `${n} người đã lấy 「${src.expression}」 về kho`,
      href: '/library',
      entityId: src.id,
      actorName: taker?.name ?? null,
    });
  } catch {
    // ignore
  }
  return { forked: true, itemId: created.id };
}

/**
 * Bulk fork (the /library selection bar): take several public items into the user's kho at once. Runs
 * each through `forkItem`, so every row keeps the same own-item + dup guards; returns how many were
 * actually taken (already-owned / own rows are skipped, not errors). Sequential — the selection is small.
 */
export async function forkItems(userId: string, sourceItemIds: string[]): Promise<number> {
  let taken = 0;
  for (const id of sourceItemIds) {
    const r = await forkItem(userId, id);
    if (r.forked) taken += 1;
  }
  return taken;
}

export interface ItemLikeResult {
  liked: boolean;
  count: number;
}

/**
 * Toggle the viewer's like on a PUBLIC library item (Phase 5 — the /library heart). Returns the new
 * state + fresh total, or null if the item isn't public (you can't like a private item). Not
 * tenant-scoped — a social object counted across owners (mirrors feed.ts toggleSentenceLike).
 */
export async function toggleItemLike(
  userId: string,
  itemId: string,
): Promise<ItemLikeResult | null> {
  const rows = await prisma.$queryRaw<{ visibility: string }[]>`
    SELECT i.visibility AS visibility FROM "Item" i WHERE i.id = ${itemId} LIMIT 1`;
  if (rows[0]?.visibility !== 'public') return null;
  const existing = await prisma.itemLike.findUnique({
    where: { itemId_userId: { itemId, userId } },
    select: { id: true },
  });
  if (existing) await prisma.itemLike.delete({ where: { id: existing.id } });
  else await prisma.itemLike.create({ data: { itemId, userId } });
  const count = await prisma.itemLike.count({ where: { itemId } });
  return { liked: !existing, count };
}

export { GRAMMAR_KIND, VOCAB_KIND };
