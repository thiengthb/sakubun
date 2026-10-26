import type { UserDb } from '@/lib/db/user-db';
import { getSettings } from '@/lib/library/practice';
import { GRAMMAR_KIND } from '@/lib/library/item-kinds';
import { STUDY_DAYS, buildDashboard, type Dashboard } from '@/lib/insights/dashboard-model';
import { studyStreak } from '@/lib/insights/streak';

const DAY_MS = 86_400_000;

/** The one read behind the Phân tích page (roadmap 5.3); the numbers come from dashboard-model.ts. */
export async function getDashboard(db: UserDb, now: Date = new Date()): Promise<Dashboard> {
  const settings = await getSettings(db);
  const since = new Date(now.getTime() - STUDY_DAYS * DAY_MS);
  const [logs, sentences, items, cards, streak] = await Promise.all([
    db.reviewLog.findMany({
      where: { reviewedAt: { gte: since } },
      select: {
        reviewedAt: true,
        rating: true,
        state: true,
        errorTags: true,
        itemId: true,
        item: { select: { expression: true } },
      },
    }),
    db.sentence.findMany({
      where: { status: 'GRADED', answeredAt: { gte: since } },
      select: {
        createdAt: true,
        answeredAt: true,
        score: true,
        sourceText: true,
        reviews: { select: { role: true, item: { select: { level: true } } } },
      },
    }),
    db.item.findMany({
      select: {
        id: true,
        kind: true,
        level: true,
        suspended: true,
        expression: true,
        meaningVi: true,
        srs: { select: { state: true, due: true, reps: true, lapses: true, difficulty: true } },
      },
    }),
    // Only grammar cards are scored for completeness; vocab enrichment is never read here.
    db.item.findMany({ where: { kind: GRAMMAR_KIND }, select: { id: true, enrichment: true } }),
    studyStreak(db, settings.dayCutoffHour, now),
  ]);
  const enrichment = new Map(cards.map((c) => [c.id, c.enrichment]));

  return buildDashboard({
    now,
    settings,
    logs: logs.map(({ item, ...l }) => ({ ...l, expression: item?.expression ?? null })),
    sentences,
    items: items.map((i) => ({ ...i, enrichment: enrichment.get(i.id) ?? null })),
    streak,
  });
}
