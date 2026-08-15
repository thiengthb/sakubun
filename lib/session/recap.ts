import { prisma } from '@/lib/db/db';
import { studyDayKey } from '@/lib/srs/streak';

export const MAX_SHAKY = 3;

const LOOKBACK_MS = 36 * 3600000;

const SCAN_CAP = 400;

export interface SessionRecap {
  daysAgo: number;
  sentences: number;
  reviews: number;
  shaky: { itemId: string; expression: string; misses: number }[];
}

export async function getSessionRecap(
  cutoffHour: number,
  now: Date = new Date(),
): Promise<SessionRecap | null> {
  const last = await prisma.reviewLog.findFirst({
        orderBy: { reviewedAt: 'desc' },
    select: { reviewedAt: true },
  });
  if (!last) return null;

  const dayKey = studyDayKey(last.reviewedAt, cutoffHour);
  const rows = await prisma.reviewLog.findMany({
    where: { reviewedAt: { gte: new Date(last.reviewedAt.getTime() - LOOKBACK_MS) } },
    select: {
      itemId: true,
      rating: true,
      reviewedAt: true,
      sentenceId: true,
      item: { select: { expression: true } },
    },
    orderBy: { reviewedAt: 'desc' },
    take: SCAN_CAP,
  });
  const session = rows.filter((r) => studyDayKey(r.reviewedAt, cutoffHour) === dayKey);

  const missesByItem = new Map<string, { expression: string; misses: number }>();
  const sentences = new Set<string>();
  for (const row of session) {
    if (row.sentenceId) sentences.add(row.sentenceId);
    if (row.rating > 2 || !row.itemId || !row.item) continue;
    const entry = missesByItem.get(row.itemId) ?? { expression: row.item.expression, misses: 0 };
    entry.misses += 1;
    missesByItem.set(row.itemId, entry);
  }

  const todayKey = studyDayKey(now, cutoffHour);
  const dayMs = 86_400_000;
  const daysAgo = Math.max(0, Math.round((Date.parse(todayKey) - Date.parse(dayKey)) / dayMs));

  return {
    daysAgo,
    sentences: sentences.size,
    reviews: session.length,
    shaky: [...missesByItem.entries()]
      .map(([itemId, e]) => ({ itemId, expression: e.expression, misses: e.misses }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, MAX_SHAKY),
  };
}
