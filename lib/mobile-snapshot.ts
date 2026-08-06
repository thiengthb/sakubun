// The whole library in one payload, shaped for a native client to cache on disk.
//
// WHY THIS IS NOT `exportUserData()` (lib/export.ts). That function's own doc says it plainly: "Field
// names + row shapes ARE the file format" — `accountBackupSchema` parses exactly it. Serving it to the
// app would weld the mobile wire format to the BACKUP format, so a field added for a phone screen
// becomes a backup-compat question, and a backup change becomes an app release. They are two contracts
// with two different reasons to change. This one also carries LESS: it drops `reviewLogs` entirely
// (analytics are computed server-side and shipped as numbers, not as thousands of rows the client would
// have to reduce itself).
//
// FULL SNAPSHOT, NO DELTA. `Item` has `createdAt` but NO `updatedAt` (prisma/schema.prisma), so there
// is no timestamp to ask "what changed since?" against. At the real size — ~100 items, a few hundred KB
// of JSON — a full pull is cheaper than the schema change plus the tombstone problem that a delta
// protocol drags in. Revisit when offline-read lands (ADR 0001, phase 5) and only if measurement says
// so; that revisit needs a migration, not a rewrite of this file.
//
// Dates are ISO strings, not Date objects — see the transformer note in lib/trpc/init.ts.
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { enrichmentSchema, parseEnrichment } from '@/lib/enrichment';
import { getSettings } from '@/lib/practice';
import { settingsSchema } from '@/lib/settings-schema';

/** `Item.tags` is a JSON string (SQLite has no native lists). A malformed or absent value is `[]` —
 *  a broken tag list must not cost the learner their whole library. */
function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export const snapshotSrsSchema = z.object({
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  scheduledDays: z.number(),
  learningSteps: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.number(),
  lastReview: z.string().nullable(),
});

export const snapshotItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  expression: z.string(),
  reading: z.string().nullable(),
  hanviet: z.string().nullable(),
  meaningVi: z.string(),
  level: z.string(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  source: z.string(),
  captureReason: z.string().nullable(),
  suspended: z.boolean(),
  starred: z.boolean(),
  enrichment: enrichmentSchema.nullable(),
  enrichedAt: z.string().nullable(),
  createdAt: z.string(),
  challenge: z.number().nullable(),
  challengeObservations: z.number(),
  /** Null until the item's first review — a NEW item has no SrsState row yet. */
  srs: snapshotSrsSchema.nullable(),
});

export const snapshotGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  color: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Item ids in this group. Flattened here so the client never has to join two arrays. */
  itemIds: z.array(z.string()),
});

export const mobileSnapshotSchema = z.object({
  /** When the server built this. The client shows it as "số liệu lúc HH:mm" rather than pretending
   *  cached numbers are live — it must never recompute them itself (ADR 0001, decision 4). */
  takenAt: z.string(),
  counts: z.object({ items: z.number(), groups: z.number() }),
  settings: settingsSchema,
  items: z.array(snapshotItemSchema),
  groups: z.array(snapshotGroupSchema),
});

export type MobileSnapshot = z.infer<typeof mobileSnapshotSchema>;

export async function buildMobileSnapshot(now: Date = new Date()): Promise<MobileSnapshot> {
  const [items, groups, members, settings] = await Promise.all([
    prisma.item.findMany({ include: { srs: true }, orderBy: { createdAt: 'desc' } }),
    prisma.group.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.groupMember.findMany({ orderBy: { addedAt: 'asc' } }),
    getSettings(),
  ]);

  const itemIdsByGroup = new Map<string, string[]>();
  for (const m of members) {
    const list = itemIdsByGroup.get(m.groupId);
    if (list) list.push(m.itemId);
    else itemIdsByGroup.set(m.groupId, [m.itemId]);
  }

  return {
    takenAt: now.toISOString(),
    counts: { items: items.length, groups: groups.length },
    settings,
    items: items.map((item) => ({
      id: item.id,
      kind: item.kind,
      expression: item.expression,
      reading: item.reading,
      hanviet: item.hanviet,
      meaningVi: item.meaningVi,
      level: item.level,
      notes: item.notes,
      tags: parseTags(item.tags),
      source: item.source,
      captureReason: item.captureReason,
      suspended: item.suspended,
      starred: item.starred,
      enrichment: parseEnrichment(item.enrichment),
      enrichedAt: item.enrichedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      challenge: item.challenge,
      challengeObservations: item.challengeObservations,
      srs: item.srs
        ? {
            due: item.srs.due.toISOString(),
            stability: item.srs.stability,
            difficulty: item.srs.difficulty,
            scheduledDays: item.srs.scheduledDays,
            learningSteps: item.srs.learningSteps,
            reps: item.srs.reps,
            lapses: item.srs.lapses,
            state: item.srs.state,
            lastReview: item.srs.lastReview?.toISOString() ?? null,
          }
        : null,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
      color: g.color,
      note: g.note,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      itemIds: itemIdsByGroup.get(g.id) ?? [],
    })),
  };
}
