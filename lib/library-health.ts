// The LIBRARY-WIDE health check behind `get_library_health` — the counterpart to `lib/lookup.ts`,
// which answers about ONE pattern. READ-ONLY.
//
// Why it is a narrow module and not `getAnalytics`: the dashboard aggregate already computes most of
// these numbers, but it also computes a 90-day heatmap, a 14-day forecast, accuracy-by-week and two
// performance breakdowns — a payload built for a page, re-serialised into a model's context. This
// returns only what a PROPOSAL needs, which is the same reason `toCompositionSettings` exists.
//
// It proposes nothing itself: the facts go to the pure `coachLibrary` in lib/coach.ts, so the
// thresholds stay testable without a database.

import { coachLibrary, type CoachResult, type LibraryHealthFacts } from '@/lib/coach';
import {
  CURRENT_ENRICHMENT_VERSION,
  needsWork,
  scoreEnrichment,
  type QualityTier,
} from '@/lib/enrichment-quality';
import { ERROR_TAG_LABELS, type ErrorTag } from '@/lib/error-tags';
import { prisma } from '@/lib/db';
import { getSettings, getWeakReport, GRAMMAR_KIND, VOCAB_KIND } from '@/lib/practice';
import { computeTrueRetention, retentionVerdict, REVIEW_STATE } from '@/lib/retention';
import { hasKanji } from '@/lib/text';

/** Window for the measured-retention verdict — the same 30 days the weak report uses. */
const RETENTION_WINDOW_DAYS = 30;

export interface LibraryHealth {
  totals: { grammar: number; vocab: number; suspended: number };
  /** Card-quality histogram over GRAMMAR items. Vocabulary is counted separately in `vocabCards`. */
  quality: Record<QualityTier, number>;
  cardVersion: { current: number; outdated: number };
  /** Coverage per STUDIED level — where a gap actually costs the learner something today. */
  byStudiedLevel: { level: string; total: number; needsWork: number }[];
  /** Un-suspended patterns EASIER than the study target. */
  belowTargetActive: number;
  retention: {
    measured: number | null;
    desired: number;
    reviews: number;
    verdict: string;
    gapPts: number | null;
  };
  /** Kanji vocabulary still missing its âm Hán Việt. */
  vocabMissingHanviet: number;
  /** Word cards measured against the VOCABULARY bar — collocations, đồng nghĩa/trái nghĩa, ví dụ có dịch. */
  vocabCards: { total: number; needsWork: number };
  weakCluster: { tag: ErrorTag; label: string; misses: number; itemIds: string[] } | null;
}

export interface LibraryHealthResult extends CoachResult {
  health: LibraryHealth;
}

const jlptNumber = (level: string): number => Number(level.slice(1));

export async function getLibraryHealth(
  now: Date = new Date(),
): Promise<LibraryHealthResult> {
  const settings = await getSettings();
  const studied = new Set<string>(settings.grammarLevels);
  // "Below target" = strictly EASIER than the easiest level being studied (N5=5 … N1=1), the same
  // definition `setBelowTargetSuspended` acts on — derived from settings, never a hardcoded level.
  const easiestStudied = Math.max(...settings.grammarLevels.map(jlptNumber));

  const [grammarRows, vocabRows, retentionRows, weak] = await Promise.all([
    prisma.item.findMany({
      where: { kind: GRAMMAR_KIND },
      select: { level: true, suspended: true, enrichment: true },
    }),
    prisma.item.findMany({
      where: { kind: VOCAB_KIND },
      // `enrichment` joined the selection on 2026-08-12: until then this file said in a comment that
      // "vocab cards are not part of the enrichment contract", so the one report that answers "what
      // should I clean up" could not see a single word card. A backlog nothing measures is a backlog
      // nobody closes.
      select: { expression: true, hanviet: true, suspended: true, enrichment: true },
    }),
    prisma.reviewLog.findMany({
      where: {
        state: REVIEW_STATE,
        reviewedAt: { gte: new Date(now.getTime() - RETENTION_WINDOW_DAYS * 86400000) },
      },
      select: { rating: true },
    }),
    getWeakReport(now),
  ]);

  const quality: Record<QualityTier, number> = {
    missing: 0,
    broken: 0,
    thin: 0,
    outdated: 0,
    ok: 0,
    rich: 0,
  };
  const perLevel = new Map<string, { total: number; needsWork: number }>();
  let outdated = 0;
  let needsWorkAtStudiedLevels = 0;
  let belowTargetActive = 0;
  let suspended = 0;

  for (const row of grammarRows) {
    // GRAMMAR_KIND, not the row's own kind: `grammarRows` is queried `where: { kind: GRAMMAR_KIND }`.
    // Passing the literal keeps that fact visible here — this report is grammar-scoped by design (the
    // same anti-N5-drag guarantee as the daily counters), it is not "the whole library".
    const report = scoreEnrichment(row.enrichment, GRAMMAR_KIND);
    quality[report.tier] += 1;
    if (report.tier === 'outdated') outdated += 1;
    if (row.suspended) suspended += 1;
    if (!row.suspended && jlptNumber(row.level) > easiestStudied) belowTargetActive += 1;

    if (studied.has(row.level)) {
      const bucket = perLevel.get(row.level) ?? { total: 0, needsWork: 0 };
      bucket.total += 1;
      // `outdated` is deliberately EXCLUDED from the enrich sweep: those cards are complete and the
      // learner loses nothing today, so they get their own lower-priority migrate proposal instead of
      // inflating the "your cards are not good enough" number.
      if (report.tier === 'missing' || report.tier === 'broken' || report.tier === 'thin') {
        bucket.needsWork += 1;
        needsWorkAtStudiedLevels += 1;
      }
      perLevel.set(row.level, bucket);
    }
  }

  const measured = computeTrueRetention(retentionRows);
  const verdict = retentionVerdict(measured, settings.desiredRetention);

  // The biggest single error-tag cluster, and the items it actually spans — a tag with a big count on
  // ONE item is a hard pattern, not a group worth creating.
  let weakCluster: LibraryHealth['weakCluster'] = null;
  const top = weak.tagCounts[0];
  if (top) {
    const itemIds = weak.worstItems.filter((i) => i.tags.includes(top.tag)).map((i) => i.itemId);
    weakCluster = {
      tag: top.tag,
      label: ERROR_TAG_LABELS[top.tag] ?? top.tag,
      misses: top.count,
      itemIds,
    };
  }

  const health: LibraryHealth = {
    totals: { grammar: grammarRows.length, vocab: vocabRows.length, suspended },
    quality,
    cardVersion: { current: CURRENT_ENRICHMENT_VERSION, outdated },
    byStudiedLevel: [...studied]
      .sort((a, b) => jlptNumber(b) - jlptNumber(a))
      .map((level) => ({
        level,
        total: perLevel.get(level)?.total ?? 0,
        needsWork: perLevel.get(level)?.needsWork ?? 0,
      })),
    belowTargetActive,
    retention: {
      measured: measured.rate,
      desired: settings.desiredRetention,
      reviews: measured.reviews,
      verdict: verdict.message,
      gapPts: verdict.gapPts,
    },
    vocabMissingHanviet: vocabRows.filter((v) => hasKanji(v.expression) && !v.hanviet).length,
    vocabCards: {
      total: vocabRows.length,
      // Scored against the VOCAB bar, and counting only ACTIVE words: a suspended word is not on the
      // learner's plate, so putting it in a clean-up number would inflate the work they can see.
      needsWork: vocabRows.filter(
        (v) => !v.suspended && needsWork(scoreEnrichment(v.enrichment, VOCAB_KIND).tier),
      ).length,
    },
    weakCluster,
  };

  const facts: LibraryHealthFacts = {
    needsWorkAtStudiedLevels,
    outdatedCards: outdated,
    belowTargetActive,
    retention: { kind: verdict.kind, gapPts: verdict.gapPts },
    desiredRetention: settings.desiredRetention,
    weakCluster,
  };

  return { health, ...coachLibrary(facts) };
}
