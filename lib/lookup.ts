// ONE-CALL library lookup: "what does the learner's library actually hold about X, and what should we
// offer them about it?" READ-ONLY — it may never write, so a lookup can never mutate the library.
//
// WHY one consolidated function instead of four composable ones. Anthropic's tool guidance is to
// prefer higher-level tools that "consolidate functionality under the hood" over one-per-endpoint
// (`schedule_event` rather than `list_users` + `list_events` + `create_event`). The practical reason
// here is stronger: a FOUR-call tree (list_grammar + list_vocab + browse shared + get_settings) is
// something Claude has to REMEMBER to do, and the study-plan feature already proved that a step Claude
// must remember decays to unused (built 2026-07-12, deleted 2026-07-14). One call can become a habit.
//
// It composes the existing read paths (`listItems`, `listPublicLibrary`) rather than querying itself,
// and hands the facts to the pure engine in `lib/coach.ts`.

import { coach, type CoachResult, type ItemFacts } from '@/lib/coach';
import { parseEnrichment } from '@/lib/enrichment';
import { scoreEnrichment, type QualityTier } from '@/lib/enrichment-quality';
import { sameExpression, stripDecoration } from '@/lib/normalize';
import { minePairs } from '@/lib/mining';
import { getSettings, listConfusionRows, listItems, todayCounts, VOCAB_KIND } from '@/lib/practice';
import { hasKanji } from '@/lib/text';


export interface LookupInput {
  /** What the learner asked about — a pattern, a word, or a fragment of a meaning. */
  query: string;
  /** Narrow to grammar or vocabulary; omitted searches both. */
  kind?: 'GRAMMAR' | 'VOCAB';
  /** True when this is an aside during practice (tightens the suggestion cap to 1). */
  midSession?: boolean;
}

/** One of the learner's OWN matches, with everything needed to decide what to offer. */
export interface MineEntry {
  itemId: string;
  kind: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  level: string;
  suspended: boolean;
  /** Quality TIER + what the card is missing. The card CONTENT is returned separately (see below). */
  tier: QualityTier;
  qualityScore: number;
  missing: string[];
  cardVersion: number;
  srs: { state: number; due: Date; lapses: number; reps: number } | null;
  /** Is this level inside settings.grammarLevels (i.e. could a NEW item here be introduced at all)? */
  levelInStudyRange: boolean;
  /**
   * The stored enrichment card, for CLAUDE ONLY — reference material for its own explanation, never
   * something to transcribe. It is deliberately kept OUT of the rendered block (see
   * `renderLibraryCheck`): if the card were shown verbatim, "explain in your own words" would be a
   * polite request rather than a property of the design.
   */
  card: string | null;
}

export interface LibraryCheck extends CoachResult {
  query: string;
  mine: MineEntry[];
  /** Study range echoed back so the tutor can explain a WIDEN_LEVELS proposal without another call. */
  grammarLevels: string[];
}

/** Cap on rows returned per side — a lookup answers about ONE thing, it is not a browse-everything. */
const MAX_MATCHES = 8;

/**
 * Rank matches so an EXACT hit (modulo tilde/quote spelling) always comes first — a substring search
 * for 「ばかり」 otherwise buries 〜ばかりに under 〜ばかりだ / 〜たばかり.
 */
function byRelevance<T extends { expression: string }>(query: string, rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aExact = sameExpression(a.expression, query) ? 0 : 1;
    const bExact = sameExpression(b.expression, query) ? 0 : 1;
    return aExact - bExact || a.expression.length - b.expression.length;
  });
}

/**
 * Look up one query across the learner's library and the public one, and compute what to offer.
 *
 * Returns EVERYTHING in a single round trip: their matches with card quality, the shared matches they
 * do not have, and the ranked proposals. Nothing is written.
 */
export async function checkLibrary(args: LookupInput): Promise<LibraryCheck> {
  // Strip the DECORATION before searching, not just before comparing. The DB search is a raw SQL LIKE,
  // so 「〜ざるを得ない」 (as Claude quotes a pattern back) found NOTHING while the learner clearly owned
  // 〜ざるを得ない — and the coach would then have offered to ADD it, creating a duplicate. Caught by
  // driving the real tool in the lab, 2026-07-27. Inner spaces and case survive, so a Vietnamese
  // meaning fragment still matches.
  const query = stripDecoration(args.query);
  const settings = await getSettings();

  // Search BOTH kinds unless told otherwise: the learner asks about "a thing", not about a table.
  const kinds: ('GRAMMAR' | 'VOCAB')[] = args.kind ? [args.kind] : ['GRAMMAR', 'VOCAB'];

  const mineRows = await Promise.all(
          // TAG each row with the kind it was QUERIED as. Inferring the kind from the row's own fields
          // (e.g. "only VOCAB has hanviet") would misclassify a kana vocab word, which has no kanji
          // and therefore no âm Hán Việt — and the kind decides which proposals are even sensible.
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
      const q = scoreEnrichment(i.enrichment);
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
    // The `with` side of each stored contrast — so a mined confusion is not offered for a distinction
    // the card already draws.
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
  // Mine the learner's OWN attested confusions — but only when something of theirs matched, so a
  // lookup about a pattern they do not own never pays for the query.
  const minedPairs =
    facts.length > 0 ? minePairs(await listConfusionRows(now), now) : undefined;

  // "Why hasn't this pattern come up?" — a NEVER-STUDIED match cannot arrive today once the daily new
  // quota is spent, and nothing on this path would otherwise say so. `renderDueBatch` reports the same
  // cap, but only for a batch that was actually requested; a lookup is where the learner ASKS.
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
    // `shared: []` đứng ở đây cùng một comment nói rằng nhánh FORK trong coach là không tới được và
    // "stays in lib/coach.ts rather than being surgically removed from a module with its own test
    // suite". Đó là món nợ được hoãn có ý thức, và 2026-08-10 nó được trả: nhánh kia đã bị bỏ, nên
    // trường này không còn gì để truyền.
    // grammarLevels drives WIDEN_LEVELS; autoCapture decides which offers the learner has already
    // pre-authorised. Nothing else of the settings blob is the coach's business.
    settings: { grammarLevels: settings.grammarLevels, autoCapture: settings.autoCapture },
    now,
    midSession: args.midSession,
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
