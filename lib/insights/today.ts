import type { UserDb } from '@/lib/db/user-db';
import { getQueue } from '@/lib/app/queue';
import { CARD_STATE, countReady } from '@/lib/domain/queue';
import { studyStreak } from '@/lib/insights/streak';
import { needsWork, scoreEnrichment } from '@/lib/library/enrichment-quality';
import { GRAMMAR_KIND, ITEM_KINDS, KANJI_KIND } from '@/lib/library/item-kinds';
import { getSettings } from '@/lib/library/practice';
import type { Streak } from '@/lib/srs/streak';
import { studyDayStart } from '@/lib/srs/select';
import {
  forecast,
  forecastEnd,
  mostMissed,
  secondsPerCard,
  studyWeek,
  todayHero,
  type MissedItem,
  type TodayHero,
  type WeekDay,
} from '@/lib/insights/today-model';

// The one read behind the Hôm nay page (plan 2026-11-14-u3-today, U3a; UI v2 B1). Read-only: the
// kanji Ôn nhanh would bring in are counted, not created. The numbers come from today-model.ts.

const DAY_MS = 86_400_000;
const RECENT_DAYS = 30;
const FORECAST_DAYS = 14;

export interface Today {
  hero: TodayHero;
  streak: Streak;
  week: WeekDay[];
  /** Grammar already studied whose card still needs work in any part (the "thẻ còn thiếu" row). */
  missingExamples: number;
  missed: MissedItem[];
  forecast: { day: string; count: number }[];
}

export async function getToday(db: UserDb, now: Date = new Date()): Promise<Today> {
  const settings = await getSettings(db);
  const since = new Date(now.getTime() - RECENT_DAYS * DAY_MS);
  const [queue, items, logs, grammar, upcoming, streak] = await Promise.all([
    getQueue(db, now, undefined, { kanji: true, introduce: false }),
    db.item.count({ where: { kind: { in: [...ITEM_KINDS] } } }),
    db.reviewLog.findMany({
      where: { reviewedAt: { gte: since } },
      select: {
        reviewedAt: true,
        rating: true,
        itemId: true,
        item: { select: { expression: true, kind: true } },
      },
    }),
    db.item.findMany({
      where: { kind: GRAMMAR_KIND, srs: { reps: { gt: 0 } } },
      select: { enrichment: true },
    }),
    db.srsState.findMany({
      where: {
        state: { not: CARD_STATE.NEW },
        due: { gt: now, lt: forecastEnd(now, FORECAST_DAYS) },
        item: { suspended: false, kind: { in: [...ITEM_KINDS, KANJI_KIND] } },
      },
      select: { due: true },
    }),
    studyStreak(db, settings.dayCutoffHour, now),
  ]);

  const reviewedAt = logs.map((l) => l.reviewedAt);
  const dayStart = studyDayStart(now, settings.dayCutoffHour).getTime();
  const ready = countReady(queue.cards);
  return {
    hero: todayHero({
      libraryEmpty: items === 0,
      // New kanji are brought in when Ôn nhanh opens, up to what today still allows.
      ready: { ...ready, newKanji: Math.max(ready.newKanji, queue.left.newKanji) },
      // With no grammar or words, every started card is a kanji Ôn nhanh brought in.
      kanjiWaiting: ready.due + ready.newKanji,
      reviewedToday: reviewedAt.filter((d) => d.getTime() >= dayStart).length,
      secPerCard: secondsPerCard(reviewedAt),
      nextDueAt: queue.nextDueAt,
    }),
    streak,
    week: studyWeek(reviewedAt, now, settings.dayCutoffHour),
    missingExamples: grammar.filter((g) =>
      needsWork(scoreEnrichment(g.enrichment, GRAMMAR_KIND).tier),
    ).length,
    missed: mostMissed(
      logs.map((l) => ({
        itemId: l.itemId,
        rating: l.rating,
        expression: l.item?.expression ?? null,
        kind: l.item?.kind ?? null,
      })),
    ),
    forecast: forecast(
      upcoming.map((u) => u.due),
      now,
      FORECAST_DAYS,
    ),
  };
}
