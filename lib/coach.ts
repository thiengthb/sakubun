// The proposal engine: given what the learner asked about and what their library actually holds,
// decide what to OFFER them. PURE (no DB, no I/O) — lib/mcp/tools/lookup.ts feeds it query results.
//
// WHY this is a pure server function instead of protocol prose. The same reason `lib/mcp/render.ts`
// owns the result block: prose rules decay as a protocol grows, and they only apply when a prompt was
// loaded at all — which is the MINORITY flow for this user (they chat freely and ask one-off
// questions). A pure function is matrix-testable, so "did we cover that scenario?" is a test rather
// than a hope. See docs/plans/2026-07-26-agentic-tutor-loop.md.
//
// A suggestion is a PROPOSAL, never a silent write: it carries the REAL tool name and pre-filled
// arguments so Claude calls the actual tool on a yes, and the audit trail stays meaningful. There is
// deliberately no `run_suggestion` dispatcher (it would hide intent and duplicate every validation).

import type { QualityReport, QualityTier } from '@/lib/enrichment-quality';
import type { MinedPair } from '@/lib/mining';
import { sameExpression } from '@/lib/normalize';
import type { Settings } from '@/lib/settings-schema';
import { LEECH_LAPSES } from '@/lib/srs';

/**
 * The per-item proposals the SERVER can compute (the coverage matrix in the plan, §2).
 *
 * Codes 14 (`RATCHET_CONTRAST`) and 15 (`CARD_SUSPECT`) were in this union and are deliberately NOT
 * here any more — see the note below the caps.
 */
export type SuggestionCode =
  | 'ADD_MISSING' // 1  not in my library and not shared anywhere
  | 'FORK_SHARED' // 2  someone published it; take a copy
  | 'ENRICH_MISSING' // 3  mine, no card
  | 'ENRICH_THIN' // 4  mine, card incomplete
  | 'ENRICH_OUTDATED' // 5  mine, card complete for an older format
  | 'ENRICH_BROKEN' // 6  mine, card unparseable → the tutor reads nothing
  | 'UNSUSPEND' // 7  mine, suspended → will never be practised
  | 'WIDEN_LEVELS' // 8  mine, never studied, level outside grammarLevels → can never be introduced
  | 'LEECH_DRILL' // 9  mine, forgotten repeatedly
  | 'PRACTICE_DUE' // 10 mine, due now
  | 'PRACTICE_NEW' // 11 mine, never studied
  | 'VOCAB_SINOVIET' // 12 mine, VOCAB with kanji but no âm Hán Việt
  | 'ENRICH_FROM_SHARED' // 13 a public copy is strictly better than mine
  | 'RAISE_NEW_CAP' // 16 a pattern the learner asked for was withheld by the daily new cap
  | 'MINED_CONTRAST' // the learner's OWN repeated mistake names a contrast the card is missing
  // ── library-wide (get_library_health), class `sweep`. These describe the KHO, not one lookup.
  | 'SWEEP_ENRICH' // 17 too many cards at a studied level still need work
  | 'SWEEP_MIGRATE' // 18 a pile of cards is stuck on an older format
  | 'TUNE_RETENTION' // 19 measured retention is off target in either direction
  | 'SUGGEST_GROUP' // 20 one error tag clusters over enough items to drill together
  | 'FASTTRACK'; // 21 a wall of below-target patterns is still in the queue

/**
 * `blocker` — it will silently NOT work as-is · `enable` — what the learner just asked for ·
 * `quality` — the library could be better · `sweep` — library-wide housekeeping (Phase 3).
 */
export type SuggestionClass = 'blocker' | 'enable' | 'quality' | 'sweep';

const CLASS_RANK: Record<SuggestionClass, number> = {
  blocker: 3,
  enable: 2,
  quality: 1,
  sweep: 0,
};

export interface Suggestion {
  code: SuggestionCode;
  /** Higher wins WITHIN a class. */
  priority: number;
  class: SuggestionClass;
  /** ONE Vietnamese line shown to the learner. */
  line: string;
  /** The REAL tool to call on yes. */
  tool: string;
  /** Pre-filled arguments, so a yes is one call and not an interrogation. */
  args: Record<string, unknown>;
  /**
   * The learner has pre-authorised this CLASS of action (`settings.autoCapture`), so Claude may call
   * the tool without asking and then report what it did. Absent = ask first, which is the default and
   * the norm. Note what this does NOT mean: the server still writes nothing — `check_library` stays
   * read-only, and the real tool call stays in the audit trail.
   */
  auto?: boolean;
}

/**
 * Hard caps. Not style: four more tool descriptions already sit in every session's context, and a
 * lookup that answers with a wall of offers is the "nagging" half of the failure mode this plan names
 * explicitly (too eager fills the library with unvetted output; too quiet sends the learner back to
 * clicking in the web UI).
 */
export const MAX_SUGGESTIONS = 2;
/** Mid-session (an aside during practice) there is a pending exercise to return to — one offer only. */
export const MAX_SUGGESTIONS_MID_SESSION = 1;
/** At most one proposal per class, so two offers can never both be "enrich something". */
const MAX_PER_CLASS = 1;

/**
 * WHY THE RATCHET IS NOT A CODE HERE (plan step 2.3, deviated 2026-07-27 — recorded in the plan file).
 *
 * `RATCHET_CONTRAST` ("your explanation named a near-synonym the card does not have") and
 * `CARD_SUSPECT` ("the stored card contradicts what you know") both depend on ONE fact this function
 * can never see: what Claude just said. The engine only knows what the LIBRARY holds.
 *
 * Every server-side proxy for them collapses: a card MISSING its contrasts already fires
 * `ENRICH_THIN` with the same tool and the same argument, and firing on a card that is already `ok`
 * would be nagging about something in good shape — the exact failure mode the caps exist to prevent.
 *
 * So the ratchet lives where the judgement lives: in the `check_library` DESCRIPTION (always in
 * context, even in a blank chat) as an instruction to OFFER the addition after explaining, executed
 * with `patch_enrichment` — which merges, so the offer is finally safe to accept. Its gate is the
 * behavioural eval (plan step 4.3), not a unit test, because it is model behaviour.
 */

// ---------------- inputs ----------------

export interface ItemFacts {
  itemId: string;
  kind: 'GRAMMAR' | 'VOCAB';
  expression: string;
  level: string;
  suspended: boolean;
  /** VOCAB only: does the surface form contain kanji (so âm Hán Việt is meaningful)? */
  hasKanji: boolean;
  hanviet: string | null;
  quality: QualityReport;
  /**
   * What the card ALREADY contrasts this pattern with (the `with` side of each entry). Needed so a
   * mined confusion is not proposed for a distinction the card makes already.
   */
  contrastTargets: string[];
  /** null when the item somehow has no SRS row (should not happen; treated as never studied). */
  srs: { state: number; due: Date; lapses: number } | null;
}

export interface SharedMatch {
  /** The PUBLIC item's id — what `fork_shared_items` takes. */
  sourceItemId: string;
  kind: 'GRAMMAR' | 'VOCAB';
  expression: string;
  level: string;
  quality: QualityReport;
}

export interface CoachInput {
  /** What the learner asked about, verbatim. */
  query: string;
  /** Matches in the learner's OWN library. */
  mine: ItemFacts[];
  /** Matches in the public library that are NOT already theirs. */
  shared: SharedMatch[];
  settings: Pick<Settings, 'grammarLevels'> & Partial<Pick<Settings, 'autoCapture'>>;
  now: Date;
  /** An aside during practice → tighter cap, because there is an exercise to return to. */
  midSession?: boolean;
  /** Expressions the scheduler withheld because the DAILY new quota was spent (lib/select.ts). */
  withheldByNewCap?: readonly string[];
  /**
   * Recurring confusion pairs mined from the learner's own review history (lib/mining.ts). Evidence
   * the SERVER holds, unlike the ratchet — which is why this one IS a code here.
   */
  minedPairs?: readonly MinedPair[];
}

export interface CoachResult {
  suggestions: Suggestion[];
  /** How many proposals were computed but dropped by the caps — rendered as one short line. */
  remaining: number;
}

// ---------------- the engine ----------------

/** Tiers where a MERGE is meaningful: there is a readable card to append to. */
const PATCHABLE_TIERS: readonly QualityTier[] = ['thin', 'outdated'];

/** Is this level inside the set new items may be introduced from? */
function levelInRange(level: string, settings: CoachInput['settings']): boolean {
  return (settings.grammarLevels as readonly string[]).includes(level);
}

function forItem(item: ItemFacts, input: CoachInput, shared: SharedMatch[]): Suggestion[] {
  const out: Suggestion[] = [];
  const label = item.expression;
  const state = item.srs?.state ?? 0;
  const neverStudied = state === 0;

  // ── blockers: the learner would ask for this and silently get nothing.
  if (item.suspended) {
    out.push({
      code: 'UNSUSPEND',
      class: 'blocker',
      priority: 90,
      line: `「${label}」 đang TẠM NGƯNG nên sẽ không bao giờ được đưa ra luyện — bật lại chứ?`,
      tool: 'set_item_suspended',
      args: { itemId: item.itemId, suspended: false },
    });
  }
  if (!item.suspended && neverStudied && !levelInRange(item.level, input.settings)) {
    out.push({
      code: 'WIDEN_LEVELS',
      class: 'blocker',
      priority: 80,
      // Naming the CAUSE matters: without it this reads as "the app is ignoring my pattern".
      line:
        `「${label}」 ở cấp ${item.level}, ngoài phạm vi đang học (${input.settings.grammarLevels.join(', ')}), ` +
        `nên chưa thể đưa vào — mở rộng sang ${item.level} chứ?`,
      tool: 'update_settings',
      args: { grammarLevels: [...input.settings.grammarLevels, item.level] },
    });
  }

  // ── enable: act on what they just asked about.
  if (!item.suspended) {
    const lapses = item.srs?.lapses ?? 0;
    if (lapses >= LEECH_LAPSES) {
      out.push({
        code: 'LEECH_DRILL',
        class: 'enable',
        priority: 70,
        line: `「${label}」 bạn đã quên ${lapses} lần — luyện riêng mẫu này ngay chứ?`,
        tool: 'get_due_items',
        args: { focusPatterns: [item.expression] },
      });
    } else if (neverStudied && levelInRange(item.level, input.settings)) {
      out.push({
        code: 'PRACTICE_NEW',
        class: 'enable',
        priority: 60,
        line: `「${label}」 có trong kho nhưng bạn chưa học lần nào — học luôn bây giờ chứ?`,
        tool: 'get_due_items',
        args: { focusPatterns: [item.expression] },
      });
      // `!neverStudied` matters: a never-studied item OUT of range falls through the branch above, and
      // a fresh SRS row is already "due", so it used to be offered as 「đang đến hạn ôn」 — telling the
      // learner to REVIEW something they have never seen. Its real blocker (WIDEN_LEVELS) is enough.
    } else if (!neverStudied && item.srs && item.srs.due.getTime() <= input.now.getTime()) {
      out.push({
        code: 'PRACTICE_DUE',
        class: 'enable',
        priority: 50,
        line: `「${label}」 đang đến hạn ôn — luyện ngay chứ?`,
        tool: 'get_due_items',
        args: { focusPatterns: [item.expression] },
      });
    }
  }

  // The learner's own attested mistake about THIS pattern, if it recurs and the card does not already
  // draw the distinction. Unlike the ratchet, the evidence is in the review log, so the server owns it.
  const mined = (input.minedPairs ?? []).find(
    (p) =>
      sameExpression(p.required, item.expression) &&
      !item.contrastTargets.some((t) => sameExpression(t, p.used)),
  );
  // When there is no card yet, the confusion must NOT be swallowed — it rides the write-a-card offer
  // instead, because "you keep mixing this up with X" is the most useful thing to know while writing it.
  const minedHint = mined
    ? ` Nhớ thêm mục phân biệt với 「${mined.used}」 — bạn đã nhầm ${mined.count} lần.`
    : '';

  // ── quality: the card the tutor reads could be better. Ordered by how badly it hurts.
  const q = item.quality;
  if (q.tier === 'missing') {
    out.push({
      code: 'ENRICH_MISSING',
      class: 'quality',
      priority: 45,
      line: `「${label}」 chưa có thẻ chi tiết — soạn thẻ (cách dùng, ví dụ, bẫy, phân biệt) chứ?${minedHint}`,
      tool: 'enrich_items',
      // `items` (not `itemIds`) with the id filled in and the card left blank: the shape is the part
      // Claude gets wrong, and the content is the part only Claude can write.
      args: { items: [{ itemId: item.itemId }] },
    });
  } else if (q.tier === 'broken') {
    out.push({
      code: 'ENRICH_BROKEN',
      class: 'quality',
      // Highest quality priority: a broken card means the tutor currently reads NOTHING, which looks
      // identical to having no card while the library reports it as done.
      priority: 46,
      line: `Thẻ của 「${label}」 bị lỗi định dạng nên hiện không dùng được gì — soạn lại chứ?${minedHint}`,
      tool: 'enrich_items',
      // `items` (not `itemIds`) with the id filled in and the card left blank: the shape is the part
      // Claude gets wrong, and the content is the part only Claude can write.
      args: { items: [{ itemId: item.itemId }] },
    });
  } else if (q.tier === 'thin') {
    out.push({
      code: 'ENRICH_THIN',
      class: 'quality',
      priority: 40,
      line: `Thẻ của 「${label}」 còn thiếu: ${q.missing.join(', ')} — bổ sung chứ?`,
      tool: 'patch_enrichment',
      // Only `itemId` — the missing parts have to be COMPOSED, so there is nothing to pre-fill. The
      // missing list belongs in the line (the learner reads it); putting it in `args` claimed a
      // parameter `patch_enrichment` does not accept, which is what the args-shape test now catches.
      args: { itemId: item.itemId },
    });
  } else if (q.tier === 'outdated') {
    out.push({
      code: 'ENRICH_OUTDATED',
      class: 'quality',
      priority: 35,
      line: `Thẻ của 「${label}」 theo format cũ (v${q.v}) — cập nhật sang format mới chứ?`,
      tool: 'enrich_items',
      // `items` (not `itemIds`) with the id filled in and the card left blank: the shape is the part
      // Claude gets wrong, and the content is the part only Claude can write.
      args: { items: [{ itemId: item.itemId }] },
    });
  }

  // A published copy that is strictly better than mine. Only offered when mine still needs work —
  // otherwise this would nag about a card that is already fine.
  const betterShared = shared.find(
    (s) => sameExpression(s.expression, item.expression) && s.quality.score > q.score,
  );
  // ONLY for a card a patch can actually repair. With `missing`/`broken` there is nothing to merge
  // INTO, so `patch_enrichment` would refuse the offer we just made — and those two tiers already have
  // their own proposal (a full write with `enrich_items`), where the shared card in the same result is
  // there to be composed from.
  if (betterShared && PATCHABLE_TIERS.includes(q.tier)) {
    out.push({
      code: 'ENRICH_FROM_SHARED',
      class: 'quality',
      priority: 42,
      line: `Có người đã chia sẻ thẻ 「${label}」 chi tiết hơn thẻ của bạn — lấy phần thiếu về chứ?`,
      tool: 'patch_enrichment',
      args: { itemId: item.itemId, fromSharedItemId: betterShared.sourceItemId },
    });
  }

  // A card that EXISTS can take the contrast directly, as a merge.
  if (mined && q.tier !== 'missing' && q.tier !== 'broken') {
    out.push({
      code: 'MINED_CONTRAST',
      class: 'quality',
      priority: 44,
      line:
        `Bạn đã ${mined.count} lần dùng 「${mined.used}」 ở chỗ đáng ra là 「${item.expression}」 — ` +
        `thêm mục phân biệt hai mẫu này vào thẻ chứ?`,
      tool: 'patch_enrichment',
      args: { itemId: item.itemId },
    });
  }

  if (item.kind === 'VOCAB' && item.hasKanji && !item.hanviet) {
    out.push({
      code: 'VOCAB_SINOVIET',
      class: 'quality',
      priority: 20,
      line: `「${label}」 chưa có âm Hán Việt — thêm vào để dễ nhớ chứ?`,
      tool: 'update_vocab',
      args: { itemId: item.itemId },
    });
  }

  return out;
}

/**
 * Rank, cap, and report the remainder.
 *
 * Ranking is class-first (a blocker always outranks a nicety) then priority within the class, so the
 * one thing that would silently fail is never crowded out by a card-polish offer.
 */
export function coach(input: CoachInput): CoachResult {
  const all: Suggestion[] = [];

  // Nothing of the learner's own matched → offer to get it, from the shared library if possible.
  if (input.mine.length === 0) {
    const match = input.shared[0];
    if (match) {
      all.push({
        code: 'FORK_SHARED',
        class: 'enable',
        priority: 75,
        line:
          `「${match.expression}」 chưa có trong kho của bạn, nhưng có trong thư viện chung ` +
          `(cấp ${match.level}) — lấy về chứ?`,
        tool: 'fork_shared_items',
        args: { sourceItemIds: [match.sourceItemId] },
      });
    } else {
      all.push({
        code: 'ADD_MISSING',
        class: 'enable',
        priority: 74,
        line: `「${input.query}」 chưa có trong kho của bạn — thêm vào để học chứ?`,
        tool: 'add_grammar',
        args: { items: [{ expression: input.query }] },
      });
    }
  }

  for (const item of input.mine) all.push(...forItem(item, input, input.shared));

  // The scheduler withheld a pattern the learner explicitly asked for. This is the reader that
  // `limits.newGrammarLimitReached` never had.
  for (const expression of input.withheldByNewCap ?? []) {
    all.push({
      code: 'RAISE_NEW_CAP',
      class: 'blocker',
      priority: 85,
      line: `「${expression}」 bị hoãn vì hết hạn mức mẫu mới hôm nay — nâng hạn mức lên chứ?`,
      tool: 'update_settings',
      args: { dailyNewGrammar: null },
    });
  }

  // Pre-authorisation is applied ONCE here rather than at each push site, so a new code cannot quietly
  // inherit "auto" by being written next to one that has it.
  const auto = input.settings.autoCapture;
  if (auto) {
    for (const s of all) {
      if (auto.fork && s.tool === 'fork_shared_items') s.auto = true;
      if (auto.enrichPatch && s.tool === 'patch_enrichment') s.auto = true;
    }
  }

  return rankAndCap(all, input.midSession ? MAX_SUGGESTIONS_MID_SESSION : MAX_SUGGESTIONS);
}

/**
 * Rank class-first (a blocker always outranks a nicety), then priority within the class, then cap —
 * shared by the per-lookup and the library-wide engines so the two can never drift into different
 * ideas of what "at most two offers" means.
 */
function rankAndCap(all: Suggestion[], cap: number): CoachResult {
  const ranked = [...all].sort(
    (a, b) => CLASS_RANK[b.class] - CLASS_RANK[a.class] || b.priority - a.priority,
  );
  const perClass = new Map<SuggestionClass, number>();
  const picked: Suggestion[] = [];
  for (const s of ranked) {
    if (picked.length >= cap) break;
    const used = perClass.get(s.class) ?? 0;
    if (used >= MAX_PER_CLASS) continue;
    perClass.set(s.class, used + 1);
    picked.push(s);
  }
  return { suggestions: picked, remaining: Math.max(0, all.length - picked.length) };
}

// ---------------- library-wide (the health check) ----------------

/**
 * Thresholds for the sweeps. All named, because each one is a judgement about when a number stops
 * being noise and starts being a chore worth interrupting the learner for — and a literal buried in a
 * condition cannot be argued with later.
 */
export const SWEEP_MIN_NEEDS_WORK = 5;
export const SWEEP_MIN_OUTDATED = 10;
export const FASTTRACK_MIN_BELOW_TARGET = 20;
export const CLUSTER_MIN_MISSES = 5;
export const CLUSTER_MIN_ITEMS = 3;
/** How far desiredRetention moves in one accepted proposal. Small: it changes every future interval. */
export const RETENTION_STEP = 0.05;

export interface LibraryHealthFacts {
  /** Cards at a STUDIED level that are missing/broken/thin — the sweep's actual target list. */
  needsWorkAtStudiedLevels: number;
  /** Complete cards stuck on an older format version. */
  outdatedCards: number;
  /** Un-suspended patterns EASIER than the study target — the queue the learner grinds through. */
  belowTargetActive: number;
  /** Measured vs target, already judged by lib/retention.ts (never re-derived here). */
  retention: { kind: 'insufficient' | 'below' | 'on-target' | 'above'; gapPts: number | null };
  desiredRetention: number;
  /** The single biggest error-tag cluster in the window, with the items it spans. */
  weakCluster: { tag: string; label: string; misses: number; itemIds: string[] } | null;
}

/**
 * What to offer about the LIBRARY as a whole. Same ranking and caps as a lookup: the point of a health
 * check is a short list of what to do next, not a report the learner has to triage.
 */
export function coachLibrary(health: LibraryHealthFacts): CoachResult {
  const all: Suggestion[] = [];

  if (health.needsWorkAtStudiedLevels >= SWEEP_MIN_NEEDS_WORK) {
    all.push({
      code: 'SWEEP_ENRICH',
      class: 'sweep',
      priority: 30,
      line: `${health.needsWorkAtStudiedLevels} mẫu ở cấp bạn đang học có thẻ chưa đạt — soạn bù một loạt chứ?`,
      // The ids have to be FETCHED before anything can be written, and `quality` is the filter that
      // makes that one call instead of a scan (plan step 3.3 exists for exactly this).
      tool: 'list_grammar',
      args: { quality: 'missing', limit: 10 },
    });
  }

  if (health.outdatedCards >= SWEEP_MIN_OUTDATED) {
    all.push({
      code: 'SWEEP_MIGRATE',
      class: 'sweep',
      priority: 20,
      line: `${health.outdatedCards} thẻ vẫn theo format cũ — cập nhật dần chứ?`,
      tool: 'list_grammar',
      args: { quality: 'outdated', limit: 10 },
    });
  }

  // Both directions are actionable and they are OPPOSITE moves, so the line must say which way and why.
  if (health.retention.kind === 'below') {
    all.push({
      code: 'TUNE_RETENTION',
      class: 'quality',
      priority: 38,
      line:
        `Bạn đang quên nhiều hơn mức lịch ôn giả định (${health.retention.gapPts} điểm) — ` +
        `nâng mục tiêu ghi nhớ để ôn dày hơn chứ?`,
      tool: 'update_settings',
      args: { desiredRetention: Math.min(0.97, round2(health.desiredRetention + RETENTION_STEP)) },
    });
  } else if (health.retention.kind === 'above') {
    all.push({
      code: 'TUNE_RETENTION',
      class: 'quality',
      priority: 34,
      line:
        `Bạn nhớ tốt hơn mục tiêu (+${health.retention.gapPts} điểm) — ` +
        `hạ mục tiêu ghi nhớ để ôn thưa hơn mà vẫn đạt kỳ vọng chứ?`,
      tool: 'update_settings',
      args: { desiredRetention: Math.max(0.8, round2(health.desiredRetention - RETENTION_STEP)) },
    });
  }

  const cluster = health.weakCluster;
  if (
    cluster &&
    cluster.misses >= CLUSTER_MIN_MISSES &&
    cluster.itemIds.length >= CLUSTER_MIN_ITEMS
  ) {
    all.push({
      code: 'SUGGEST_GROUP',
      class: 'quality',
      priority: 36,
      line:
        `${cluster.itemIds.length} mẫu đang cùng dính lỗi "${cluster.label}" (${cluster.misses} lần) — ` +
        `gom thành một nhóm để luyện tập trung chứ?`,
      tool: 'suggest_group',
      args: { name: `Lỗi ${cluster.label}`, itemIds: cluster.itemIds },
    });
  }

  if (health.belowTargetActive >= FASTTRACK_MIN_BELOW_TARGET) {
    all.push({
      code: 'FASTTRACK',
      class: 'sweep',
      priority: 25,
      line:
        `${health.belowTargetActive} mẫu dưới cấp đang học vẫn nằm trong hàng đợi — ` +
        `tạm ẩn chúng để đi thẳng vào cấp của bạn chứ? (bật lại được bất cứ lúc nào)`,
      tool: 'set_below_target_suspended',
      args: { suspended: true },
    });
  }

  return rankAndCap(all, MAX_SUGGESTIONS);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------- teach-back harvest (plan step 7.3) ----------------

/**
 * The loop that makes teach-back more than a drill: an explanation the learner produced and that
 * GRADED WELL is content the model could not have written — it is what made the pattern stick for
 * THIS person. Offering it as the card's `usage` line is how a session leaves the DOMAIN model richer,
 * the same way the dossier leaves the STUDENT model richer.
 *
 * WHY IT IS NOT A `SuggestionCode` (the same reasoning as the ratchet note above, reached from the
 * other direction). A `Suggestion` promises a one-word yes turns into ONE pre-filled tool call. This
 * one cannot: the only safe target is a pattern with NO card at all, and writing a first card goes
 * through `enrich_items`, whose schema REQUIRES a canonical example and a usage line — so Claude still
 * has to compose the rest of the card around the learner's words. Forcing it into `Suggestion.args`
 * would ship arguments that fail validation, which is worse than an honest half-filled offer.
 *
 * WHY ONLY A CARD-LESS PATTERN. `enrichmentSchema.usage` is REQUIRED, so a readable card always has a
 * usage line, and "harvest into the empty slot" does not exist — the only alternative would be to
 * REPLACE a usage that is already there. That is destructive, unreviewable, and would fire on most
 * turns; the caps in this file exist precisely to stop that shape of nagging. A card-less pattern the
 * learner can already explain well is the case where their words are the best content available.
 */
export const TEACH_BACK_MIN_RATING = 3;
/** Below this it is an answer, not a usage line — a card made of "nghĩa là buộc phải làm" helps nobody. */
export const TEACH_BACK_MIN_CHARS = 40;
/** Above this it is an essay. The usage field is ONE line of nuance; Claude trims, it does not paste. */
export const TEACH_BACK_MAX_CHARS = 600;

export interface TeachBackFacts {
  itemId: string;
  expression: string;
  /** The rating Claude just gave the EXPLANATION (not a translation). */
  rating: number;
  /** The learner's explanation, verbatim as they wrote it. */
  explanation: string;
  /** Does the item already carry a readable enrichment card? */
  hasCard: boolean;
}

export interface TeachBackHarvest {
  itemId: string;
  expression: string;
  /** The learner's own words, trimmed — the intended `usage` line, to be kept in THEIR voice. */
  usage: string;
  rating: number;
}

/** Decide whether this teach-back turn produced something worth offering to the card. PURE. */
export function coachTeachBack(facts: TeachBackFacts): TeachBackHarvest | null {
  if (facts.hasCard) return null;
  if (facts.rating < TEACH_BACK_MIN_RATING) return null;
  const usage = facts.explanation.trim().replace(/\s+/g, ' ');
  if (usage.length < TEACH_BACK_MIN_CHARS || usage.length > TEACH_BACK_MAX_CHARS) return null;
  return { itemId: facts.itemId, expression: facts.expression, usage, rating: facts.rating };
}
