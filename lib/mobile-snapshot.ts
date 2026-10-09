import { z } from 'zod';
import { prisma } from '@/lib/db';
import { enrichmentSchema, parseEnrichment } from '@/lib/enrichment';
import { getSettings } from '@/lib/practice';
import { settingsSchema } from '@/lib/settings-schema';

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
  itemIds: z.array(z.string()),
});

export const mobileSnapshotSchema = z.object({
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
