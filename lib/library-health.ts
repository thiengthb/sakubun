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

const RETENTION_WINDOW_DAYS = 30;

export interface LibraryHealth {
  totals: { grammar: number; vocab: number; suspended: number };
  quality: Record<QualityTier, number>;
  cardVersion: { current: number; outdated: number };
  byStudiedLevel: { level: string; total: number; needsWork: number }[];
  belowTargetActive: number;
  retention: {
    measured: number | null;
    desired: number;
    reviews: number;
    verdict: string;
    gapPts: number | null;
  };
  vocabMissingHanviet: number;
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
  const easiestStudied = Math.max(...settings.grammarLevels.map(jlptNumber));

  const [grammarRows, vocabRows, retentionRows, weak] = await Promise.all([
    prisma.item.findMany({
      where: { kind: GRAMMAR_KIND },
      select: { level: true, suspended: true, enrichment: true },
    }),
    prisma.item.findMany({
      where: { kind: VOCAB_KIND },
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
    const report = scoreEnrichment(row.enrichment, GRAMMAR_KIND);
    quality[report.tier] += 1;
    if (report.tier === 'outdated') outdated += 1;
    if (row.suspended) suspended += 1;
    if (!row.suspended && jlptNumber(row.level) > easiestStudied) belowTargetActive += 1;

    if (studied.has(row.level)) {
      const bucket = perLevel.get(row.level) ?? { total: 0, needsWork: 0 };
      bucket.total += 1;
      if (report.tier === 'missing' || report.tier === 'broken' || report.tier === 'thin') {
        bucket.needsWork += 1;
        needsWorkAtStudiedLevels += 1;
      }
      perLevel.set(row.level, bucket);
    }
  }

  const measured = computeTrueRetention(retentionRows);
  const verdict = retentionVerdict(measured, settings.desiredRetention);

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
