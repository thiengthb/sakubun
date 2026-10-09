import { coach, type CoachResult, type ItemFacts } from '@/lib/coach';
import { parseEnrichment } from '@/lib/enrichment';
import { scoreEnrichment, type QualityTier } from '@/lib/enrichment-quality';
import { sameExpression, stripDecoration } from '@/lib/normalize';
import { minePairs } from '@/lib/mining';
import { getSettings, listConfusionRows, listItems, todayCounts, VOCAB_KIND } from '@/lib/practice';
import { hasKanji } from '@/lib/text';

export interface LookupInput {
  query: string;
  kind?: 'GRAMMAR' | 'VOCAB';
  midSession?: boolean;
}

export interface MineEntry {
  itemId: string;
  kind: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  level: string;
  suspended: boolean;
  tier: QualityTier;
  qualityScore: number;
  missing: string[];
  cardVersion: number;
  srs: { state: number; due: Date; lapses: number; reps: number } | null;
  levelInStudyRange: boolean;
  card: string | null;
}

export interface LibraryCheck extends CoachResult {
  query: string;
  mine: MineEntry[];
  grammarLevels: string[];
}

const MAX_MATCHES = 8;

function byRelevance<T extends { expression: string }>(query: string, rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aExact = sameExpression(a.expression, query) ? 0 : 1;
    const bExact = sameExpression(b.expression, query) ? 0 : 1;
    return aExact - bExact || a.expression.length - b.expression.length;
  });
}

export async function checkLibrary(args: LookupInput): Promise<LibraryCheck> {
  const query = stripDecoration(args.query);
  const settings = await getSettings();

  const kinds: ('GRAMMAR' | 'VOCAB')[] = args.kind ? [args.kind] : ['GRAMMAR', 'VOCAB'];

  const mineRows = await Promise.all(
          kinds.map(async (kind) =>
            (await listItems({ kind, search: query, limit: MAX_MATCHES })).map((row) => ({
              ...row,
              kind,
            })),
          ),
  ).then((lists) => lists.flat());

  const mine: MineEntry[] = byRelevance(query, mineRows)
    .slice(0, MAX_MATCHES)
    .map((i) => {
      const q = scoreEnrichment(i.enrichment, i.kind);
      return {
        itemId: i.itemId,
        kind: i.kind,
        expression: i.expression,
        reading: i.reading,
        meaningVi: i.meaningVi,
        level: i.level,
        suspended: i.suspended,
        tier: q.tier,
        qualityScore: q.score,
        missing: q.missing,
        cardVersion: q.v,
        srs: i.srs
          ? { state: i.srs.state, due: i.srs.due, lapses: i.srs.lapses, reps: i.srs.reps }
          : null,
        levelInStudyRange: settings.grammarLevels.includes(i.level as never),
        card: i.enrichment,
      };
    });

  const facts: ItemFacts[] = mine.map((m) => ({
    itemId: m.itemId,
    kind: m.kind === VOCAB_KIND ? 'VOCAB' : 'GRAMMAR',
    expression: m.expression,
    level: m.level,
    suspended: m.suspended,
    hasKanji: hasKanji(m.expression),
    hanviet: mineRows.find((r) => r.itemId === m.itemId)?.hanviet ?? null,
    contrastTargets: (parseEnrichment(m.card)?.contrasts ?? []).map((c) => c.with),
    quality: {
      tier: m.tier,
      score: m.qualityScore,
      missing: m.missing,
      v: m.cardVersion,
      broken: m.tier === 'broken',
    },
    srs: m.srs ? { state: m.srs.state, due: m.srs.due, lapses: m.srs.lapses } : null,
  }));

  const now = new Date();
  const minedPairs =
    facts.length > 0 ? minePairs(await listConfusionRows(now), now) : undefined;

  const neverStudied = facts.filter((f) => !f.suspended && (f.srs?.state ?? 0) === 0);
  let withheldByNewCap: string[] | undefined;
  if (neverStudied.length > 0) {
    const today = await todayCounts(settings, now);
    if (today.newGrammar >= settings.dailyNewGrammar) {
      withheldByNewCap = neverStudied.map((f) => f.expression);
    }
  }

  const result = coach({
    query,
    mine: facts,
    settings: {
      grammarLevels: settings.grammarLevels,
      autoCapture: settings.autoCapture,
      dailyNewGrammar: settings.dailyNewGrammar,
    },
    now,
    midSession: args.midSession,
    kind: args.kind,
    minedPairs,
    withheldByNewCap,
  });

  return {
    query,
    mine,
    grammarLevels: [...settings.grammarLevels],
    ...result,
  };
}
