// The notification feed — everything that happened while the learner was not looking.
//
// Written ONLY by the server code that performed the action. The client never creates a row and an MCP
// tool never creates one directly: a notification the tutor could forge would be a channel for it to
// tell the learner things the app never did.
//
// Two properties carry the whole design:
//
//  1. **A notification is a POINTER.** It keeps `href`, `entityId` and a short Vietnamese line — never a
//     copy of the sentence or the card. Copies go stale the moment the subject is edited or deleted,
//     and a feed of stale copies is worse than no feed.
//  2. **Coalescing is part of the model, not a later optimisation.** An import of 40 items must post ONE
//     row saying 40. The failure mode of this whole feature is a badge that is permanently non-zero and
//     therefore stops being read, so the schema carries `count` and every high-frequency kind folds.
//
// Every read and write is scoped by `userId`; the Prisma guard in lib/db.ts throws on a query that
// forgets, so tenancy is fail-closed rather than remembered.

import { prisma } from '@/lib/db';

/** A same-kind event inside this window folds into the existing UNREAD row instead of inserting. */
export const COALESCE_WINDOW_MIN = 60;

/** How many rows the bell's popover shows before "xem tất cả". */
export const BELL_PREVIEW_LIMIT = 8;

/**
 * How a kind folds:
 *  - `none`   — every event is its own row. For things the learner clicks INTO individually; a graded
 *               sentence cannot be merged with another because each points at a different modal.
 *  - `kind`   — all recent unread events of this kind become one row ("Claude đã thêm 12 mục").
 *  - `entity` — folds per subject, so likes on two different sentences stay two rows.
 */
export type CoalesceMode = 'none' | 'kind' | 'entity';

export const NOTIFICATION_KINDS = {
  SENTENCE_GRADED: { coalesce: 'none' },
  ITEMS_ADDED: { coalesce: 'kind' },
  ITEMS_UPDATED: { coalesce: 'kind' },
  ITEMS_DELETED: { coalesce: 'kind' },
  ITEM_FORKED: { coalesce: 'entity' },
  SENTENCE_LIKED: { coalesce: 'entity' },
  SENTENCE_COMMENTED: { coalesce: 'entity' },
  COMMENT_VOTED: { coalesce: 'entity' },
  LEECH_DETECTED: { coalesce: 'kind' },
  CALIBRATION_PROPOSED: { coalesce: 'kind' },
  USER_REGISTERED: { coalesce: 'kind' },
} as const satisfies Record<string, { coalesce: CoalesceMode }>;

export type NotificationKind = keyof typeof NOTIFICATION_KINDS;

export interface NotifyInput {
  kind: NotificationKind;
  /** The line for a single event, in Vietnamese. */
  title: string;
  /** Recomputed when events fold, so a merged row never still says "1 mục". */
  pluralTitle?: (count: number) => string;
  body?: string | null;
  href?: string | null;
  entityId?: string | null;
  /** Who did it, for social events. Null when the app or Claude did it. */
  actorName?: string | null;
}

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  entityId: string | null;
  actorName: string | null;
  count: number;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Record one event for one recipient, folding into a recent unread row where the kind allows it.
 *
 * Callers treat this as a PASSENGER: the action that caused the notification must succeed whether or
 * not this does (`.catch(() => null)` at the call site). A learner losing a graded review because a
 * notification insert failed would be the feature actively making the app worse.
 */
export async function notify(
  userId: string,
  input: NotifyInput,
  now: Date = new Date(),
): Promise<void> {
  const mode: CoalesceMode = NOTIFICATION_KINDS[input.kind].coalesce;

  if (mode !== 'none') {
    const since = new Date(now.getTime() - COALESCE_WINDOW_MIN * 60_000);
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        kind: input.kind,
        readAt: null,
        updatedAt: { gte: since },
        // 'entity' folds per subject; 'kind' folds everything of this kind regardless of subject.
        ...(mode === 'entity' ? { entityId: input.entityId ?? null } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      const count = existing.count + 1;
      await prisma.notification.update({
        where: { id: existing.id, userId },
        data: {
          count,
          title: input.pluralTitle?.(count) ?? input.title,
          body: input.body ?? existing.body,
          // The newest actor wins: "Minh và 2 người khác" reads better than the first one forever.
          actorName: input.actorName ?? existing.actorName,
          updatedAt: now,
        },
      });
      return;
    }
  }

  await prisma.notification.create({
    data: {
      userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      entityId: input.entityId ?? null,
      actorName: input.actorName ?? null,
      createdAt: now,
      updatedAt: now,
    },
  });
}

/** Newest first, by `updatedAt` so a freshly-folded row rises back to the top. */
export async function listNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: Math.max(1, Math.min(200, limit)),
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Returns false when the row is not this user's — a foreign id reads as "not found", never as another
 * member's row. */
export async function markRead(
  userId: string,
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { count } = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: now },
  });
  return count > 0;
}

export async function markAllRead(userId: string, now: Date = new Date()): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: now },
  });
  return count;
}

/**
 * Everyone who should receive an admin-facing event. Kept here rather than at the call site so
 * "who is an admin" has one definition; a new admin starts receiving them with no further wiring.
 */
export async function adminUserIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: 'admin', banned: { not: true } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Fan an event out to every admin. Same passenger rule as `notify`. */
export async function notifyAdmins(input: NotifyInput, now: Date = new Date()): Promise<void> {
  const ids = await adminUserIds();
  await Promise.all(ids.map((id) => notify(id, input, now)));
}
