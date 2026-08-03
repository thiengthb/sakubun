// Practice service — the ONLY layer that touches the DB for the practice loop. Both the MCP tools
// and the UI Server Actions call these functions, so behavior stays identical across surfaces.

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import {
  MASTERY_MIN_GRADUATED,
  pickBatch,
  studyDayStart,
  type ItemLite,
  type ItemRole,
  type PickedBatch,
} from '@/lib/select';
import { cleanText, cleanTextOrNull, cleanVocabTerm, hasKanji } from '@/lib/text';
import {
  parseErrorDetail,
  parseErrorTags,
  serializeErrorDetail,
  type Confusion,
  type ErrorTag,
} from '@/lib/error-tags';
import { parseEnrichment, toTutorCard, type Enrichment } from '@/lib/enrichment';
import {
  mergeEnrichment,
  type EnrichmentAdd,
  type EnrichmentPatch,
  type EnrichmentSet,
  type MergeReport,
} from '@/lib/enrichment-merge';
import { needsWork, scoreEnrichment, type QualityTier } from '@/lib/enrichment-quality';
import { coachTeachBack, type TeachBackHarvest } from '@/lib/coach';
import {
  recordLearnerNote,
  type LearnerNoteInput,
  type RecordNoteResult,
} from '@/lib/learner-notes';
import type { ConfusionRow } from '@/lib/mining';
import { sameExpression, stripDecoration } from '@/lib/normalize';
import {
  buildQuizOptions,
  MAX_DISTRACTOR_CANDIDATES,
  mergeDistractorCandidates,
  type QuizOptions,
} from '@/lib/quiz-options';
import { earnedRating, type Rating } from '@/lib/rating-guard';
import { type Streak, computeStreak, studyDayKey } from '@/lib/streak';
import {
  LEECH_LAPSES,
  newSrsFields,
  rateOnce,
  SUSPEND_SUGGEST_LAPSES,
  type RatingValue,
  type SrsFields,
} from '@/lib/srs';
import {
  axesFor,
  initialAbility,
  initialChallenge,
  proposeAdjustment,
  RATING_OUTCOME,
  RUNG_ORDER,
  successEstimate,
  updateElo,
  type AbilityAxis,
  type Proposal,
  type Rung,
} from '@/lib/calibration';
import {
  JLPT_LEVELS,
  migrateSettingsInput,
  parseStoredSettings,
  settingsPatchSchema,
  toCompositionSettings,
  type CompositionSettings,
  type Settings,
  type SettingsPatch,
} from '@/lib/settings-schema';

// ---------------- settings ----------------

export async function getSettings(): Promise<Settings> {
  // Singleton: one settings row for the one learner (see prisma/schema.prisma).
  const row = await prisma.settings.findFirst({ orderBy: { id: 'asc' } });
  return parseStoredSettings(row?.data);
}

export async function saveSettings(patch: SettingsPatch): Promise<Settings> {
  // migrateSettingsInput: a patch may still name the pre-split `levels` (2026-07-26) — from a stored
  // form, an older client, or Claude writing from habit. Map it before validating.
  const validated = settingsPatchSchema.parse(migrateSettingsInput(patch));
  const merged: Settings = { ...(await getSettings()), ...validated };
  const data = JSON.stringify(merged);
  // Singleton row: update the existing one, or create the first. Not an upsert — there is no stable
  // unique key to upsert on now that `userId` is gone and `id` is autoincrement.
  const existing = await prisma.settings.findFirst({ orderBy: { id: 'asc' } });
  if (existing) await prisma.settings.update({ where: { id: existing.id }, data: { data } });
  else await prisma.settings.create({ data: { data } });
  return merged;
}

// ---------------- items ----------------

// Why a VOCAB word was captured into the inbox (null = a plain look-up). Claude picks one when it
// proactively flags a word during practice; drives the /vocab reason badge + filter.
export const VOCAB_CAPTURE_REASONS = ['misused', 'unclear', 'unknown'] as const;
export type VocabCaptureReason = (typeof VOCAB_CAPTURE_REASONS)[number];

export interface ItemInput {
  expression: string;
  meaningVi: string;
  reading?: string;
  hanviet?: string;
  level?: string;
  notes?: string;
  tags?: string[];
  captureReason?: VocabCaptureReason;
}

export interface AddItemsResult {
  created: number;
  skipped: { expression: string; reason: string }[];
}

// The two study-item kinds. GRAMMAR = a scheduled grammar pattern (the core loop). VOCAB = a word the
// user looked up mid-practice, revived 2026-07-11 (demand-driven, in-context — NOT the top-down N5 list
// purged 2026-07-07; the `kind` column was kept precisely so this revival stayed cheap). The `kind`
// filter keeps the two loops separate so vocab can never crowd grammar (the N5-drag lesson).
export const GRAMMAR_KIND = 'GRAMMAR';
export const VOCAB_KIND = 'VOCAB';

/** The exercise type whose answer is an EXPLANATION, not a translation (plan §10, shipped 2026-07-27). */
export const TEACH_BACK_EXERCISE = 'TEACH_BACK';

export async function addItems(
  entries: ItemInput[],
  source = 'MCP',
  kind: string = GRAMMAR_KIND,
): Promise<AddItemsResult> {
  const result: AddItemsResult = { created: 0, skipped: [] };

  // Pass 1 — sanitize + in-memory dedupe. Sanitize at the write boundary: entries from the MAZII import
  // (and anything an MCP client sends) can carry `&nbsp;`/HTML entities that would render literally.
  const seen = new Set<string>();
  const candidates: { expression: string; meaningVi: string; entry: ItemInput }[] = [];
  for (const entry of entries) {
    const cleaned = cleanText(entry.expression);
    // VOCAB only: strip the display decoration Claude wraps a word in when it asks the learner about it
    // (「言葉」, a trailing "(chưa hiểu)"). A GRAMMAR pattern is left alone — it legitimately carries
    // parentheses. See cleanVocabTerm for why the prompt fix alone is not enough.
    const expression = kind === VOCAB_KIND ? cleanVocabTerm(cleaned) : cleaned;
    const meaningVi = cleanText(entry.meaningVi);
    if (!expression) {
      result.skipped.push({
        expression: cleaned,
        reason: cleaned
          ? 'chỉ còn lại nhãn/ngoặc sau khi làm sạch — gửi lại đúng từ gốc'
          : 'thiếu expression hoặc meaningVi',
      });
      continue;
    }
    if (!meaningVi) {
      result.skipped.push({ expression, reason: 'thiếu expression hoặc meaningVi' });
      continue;
    }
    if (seen.has(expression)) {
      result.skipped.push({ expression, reason: 'trùng trong danh sách gửi lên' });
      continue;
    }
    seen.add(expression);
    candidates.push({ expression, meaningVi, entry });
  }

  // Pass 2 — ONE query for everything already in the store (was a per-row findUnique = N+1 on import).
  const existingRows = await prisma.item.findMany({
    where: { kind, expression: { in: candidates.map((c) => c.expression) } },
    select: { expression: true },
  });
  const existing = new Set(existingRows.map((r) => r.expression));

  const creates: Prisma.PrismaPromise<unknown>[] = [];
  for (const { expression, meaningVi, entry } of candidates) {
    if (existing.has(expression)) {
      result.skipped.push({ expression, reason: 'đã có trong kho' });
      continue;
    }
    // Drop a reading for a kana-only surface (no kanji) — it just repeats the expression; Claude keeps
    // sending one anyway. Applies to grammar patterns AND kana vocab.
    const reading = hasKanji(expression) ? cleanTextOrNull(entry.reading) : null;
    creates.push(
      prisma.item.create({
        data: {
          kind,
          expression,
          reading,
          hanviet: cleanTextOrNull(entry.hanviet),
          meaningVi,
          level: entry.level ?? 'N5',
          notes: cleanTextOrNull(entry.notes),
          tags: entry.tags?.length ? JSON.stringify(entry.tags) : null,
          captureReason: entry.captureReason ?? null,
          source,
          // userId denormalized onto SrsState too (the hot due-query filters it directly, and the
          // tenancy guard requires it on every user-owned row).
          srs: { create: { ...newSrsFields() } },
        },
      }),
    );
  }

  // Atomic: a large import (importItemsAction feeds up to ~2000 rows) lands whole or not at all — no
  // half-commit if a concurrent read trips SQLITE_BUSY midway (was N auto-committed creates in a loop).
  if (creates.length > 0) await prisma.$transaction(creates);
  result.created = creates.length;
  return result;
}

// ---------------- due batch ----------------

interface SrsRow extends SrsFields {
  item: {
    id: string;
    expression: string;
    reading: string | null;
    meaningVi: string;
    level: string;
    notes: string | null;
    enrichment: string | null;
  };
}

function toLite(row: SrsRow, isNew: boolean): ItemLite {
  return {
    id: row.item.id,
    expression: row.item.expression,
    reading: row.item.reading,
    meaningVi: row.item.meaningVi,
    level: row.item.level,
    notes: row.item.notes,
    isNew,
    enrichment: toTutorCard(row.item.enrichment, isNew),
    lapses: row.lapses,
  };
}

/** Last few sentence contexts per item — the protocol's novelty guard ("don't repeat these"). */
async function recentContextsFor(
  itemIds: string[],
  perItem = 3,
): Promise<Record<string, string[]>> {
  if (itemIds.length === 0) return {};
  // Per-item query so a single hot pattern (many recent reviews) can't exhaust a shared `take` budget
  // and starve the other batch items of their "bối cảnh đã dùng" list. The batch is small (a sentence's
  // worth of patterns), and each read hits the `@@index([itemId, reviewedAt])` on ReviewLog, so it's cheap.
  const entries = await Promise.all(
    itemIds.map(async (itemId) => {
      const logs = await prisma.reviewLog.findMany({
        where: { itemId, sentenceId: { not: null } },
        orderBy: { reviewedAt: 'desc' },
        take: perItem * 3, // headroom so dedupe still fills up to perItem distinct labels
        select: { sentence: { select: { context: true, sourceText: true } } },
      });
      const labels: string[] = [];
      for (const log of logs) {
        if (!log.sentence) continue;
        const label = log.sentence.context || `${log.sentence.sourceText.slice(0, 40)}…`;
        if (!labels.includes(label)) labels.push(label);
        if (labels.length >= perItem) break;
      }
      return [itemId, labels] as const;
    }),
  );
  return Object.fromEntries(entries.filter(([, labels]) => labels.length > 0));
}

export interface TodayCounts {
  reviews: number;
  newGrammar: number;
  /** GRADED sentences today (completed work) — drives the daily goal + ALTERNATING parity. */
  sentences: number;
}

export async function todayCounts(
  settings: Settings,
  now: Date = new Date(),
): Promise<TodayCounts> {
  const dayStart = studyDayStart(now, settings.dayCutoffHour);
  // reviews/newGrammar are GRAMMAR-scoped: they drive the grammar daily caps (maxReviewsPerDay,
  // dailyNewGrammar) in pickBatch, so vocab reviews must NOT count here or vocab would silently eat
  // the grammar budget (the anti-N5-drag guarantee). Vocab rides its own per-sentence cap instead.
  const [reviews, newGrammar, sentences] = await Promise.all([
    prisma.reviewLog.count({
      where: { reviewedAt: { gte: dayStart }, item: { kind: GRAMMAR_KIND } },
    }),
    prisma.reviewLog.count({
      where: { reviewedAt: { gte: dayStart }, state: 0, item: { kind: GRAMMAR_KIND } },
    }),
    // GRADED only: a staged-but-unanswered (PENDING) or skipped/quiz row is not a completed sentence,
    // so it must not tick the daily goal ("câu X/goal") nor shift the ALTERNATING JA↔VI parity.
    prisma.sentence.count({ where: { createdAt: { gte: dayStart }, status: 'GRADED' } }),
  ]);
  return { reviews, newGrammar, sentences };
}

export interface FocusInput {
  /** Practice a whole JLPT level ("hôm nay luyện N3"). */
  levels?: string[];
  /** Specific patterns — substring-matched against expression / reading / meaningVi. */
  patterns?: string[];
  /** Weakness drill — server auto-selects the patterns the user misses most (rating ≤ 2 in the last
   * 30 days) plus chronic leeches, so "điểm yếu" becomes a practice generator, not just a report. */
  weak?: boolean;
  /** Scope to a study group — practice only the GRAMMAR items in this group (any VOCAB in the group
   * is not schedulable in the grammar loop, so it simply doesn't match). Feeds "luyện nhóm X". */
  groupId?: string;
}

export interface FocusMeta extends FocusInput {
  /** Store items matching the request. 0 → tell the user (offer add_grammar or random practice). */
  matched: number;
  /** Requested pattern strings that matched nothing in the store — genuinely ABSENT. */
  unmatchedPatterns: string[];
  /**
   * Requested patterns that ARE in the library but SUSPENDED, so `focusRows` (which filters
   * `suspended: false`) could never return them.
   *
   * Without this they fell into `unmatchedPatterns` and the sheet said "NOT in the library" — false,
   * and actively harmful: the tutor then offers `add_grammar` and the learner ends up with a DUPLICATE
   * of a pattern they already own. Found in the runtime lab, 2026-07-26.
   */
  suspendedPatterns: { pattern: string; itemId: string; expression: string }[];
}

export interface WeakSpots {
  /** Most-missed error tags in the window (capped at 2 — over-steering guard). */
  topTags: { tag: ErrorTag; count: number }[];
  /** Batch itemId → tags it was recently missed on (the sentence should re-test these). */
  byItem: Record<string, ErrorTag[]>;
}

export interface DueBatch extends PickedBatch {
  /**
   * ONLY the settings composition steers by (see COMPOSITION_SETTING_KEYS). This object rides on
   * EVERY get_due_items result, so an irrelevant field costs tokens once per TURN — the full object
   * still reaches get_settings and the settings page.
   */
  settings: CompositionSettings;
  today: TodayCounts;
  dueNow: number;
  newAvailable: { grammar: number };
  /** Focused-practice request echoed back (null = normal FSRS-driven batch). */
  focus: FocusMeta | null;
  /** Recent misses (rating ≤ 2, last 14 days) — composition targets these deliberately. */
  weakSpots: WeakSpots;
  /**
   * New (never-reviewed) patterns that exist in the store but are OUTSIDE settings.grammarLevels, so they
   * can't be introduced. Non-zero + empty batch = "not done, your study levels just exclude them".
   */
  newBeyondLevels: number;
  /** Earliest upcoming due (learning steps land here) — lets the tutor say "quay lại sau X phút". */
  nextDueAt: Date | null;
  /** itemId → last few sentence contexts (novelty guard: the next sentence must avoid these). */
  recentContexts: Record<string, string[]>;
}

/** Grammar items the user is weakest on: recently missed (rating ≤ 2 in the window) OR chronic leeches. */
async function weakGrammarItemIds(now: Date, windowDays = 30): Promise<string[]> {
  const since = new Date(now.getTime() - windowDays * 86400000);
  const [misses, leeches] = await Promise.all([
    prisma.reviewLog.findMany({
      where: {
        reviewedAt: { gte: since },
        rating: { lte: 2 },
        item: { is: { suspended: false, kind: GRAMMAR_KIND } },
      },
      select: { itemId: true },
    }),
    prisma.srsState.findMany({
      where: {
        lapses: { gte: LEECH_LAPSES },
        item: { suspended: false, kind: GRAMMAR_KIND },
      },
      select: { itemId: true },
    }),
  ]);
  const ids = new Set<string>();
  for (const m of misses) if (m.itemId) ids.add(m.itemId);
  for (const l of leeches) ids.add(l.itemId);
  return [...ids];
}

/** Items matching a focus request, regardless of dueness or settings.grammarLevels (explicit ask wins). */
async function focusRows(focus: FocusInput, now: Date) {
  const or: Prisma.ItemWhereInput[] = [];
  if (focus.levels?.length) or.push({ level: { in: focus.levels } });
  for (const p of focus.patterns ?? []) {
    or.push(
      { expression: { contains: p } },
      { reading: { contains: p } },
      { meaningVi: { contains: p } },
    );
  }
  if (focus.weak) {
    const weakIds = await weakGrammarItemIds(now);
    if (weakIds.length) or.push({ id: { in: weakIds } });
  }
  if (or.length === 0) return [];
  return prisma.srsState.findMany({
    where: { item: { suspended: false, kind: GRAMMAR_KIND, OR: or } },
    include: { item: true },
    orderBy: { due: 'asc' },
    take: 100,
  });
}

/**
 * Of the patterns that matched NOTHING schedulable, which ones exist but are SUSPENDED?
 *
 * Runs only over the leftovers (usually zero rows), so the common path pays nothing. It is the
 * difference between "you don't have this" and "you paused this", and those need opposite fixes.
 */
async function suspendedFocusMatches(
  patterns: string[],
): Promise<FocusMeta['suspendedPatterns']> {
  if (patterns.length === 0) return [];
  const rows = await prisma.item.findMany({
    where: {
      kind: GRAMMAR_KIND,
      suspended: true,
      OR: patterns.flatMap((p) => [
        { expression: { contains: p } },
        { reading: { contains: p } },
        { meaningVi: { contains: p } },
      ]),
    },
    select: { id: true, expression: true, reading: true, meaningVi: true },
    take: 20,
  });
  const out: FocusMeta['suspendedPatterns'] = [];
  for (const p of patterns) {
    const needle = p.toLowerCase();
    const hit = rows.find((r) =>
      `${r.expression} ${r.reading ?? ''} ${r.meaningVi}`.toLowerCase().includes(needle),
    );
    if (hit) out.push({ pattern: p, itemId: hit.id, expression: hit.expression });
  }
  return out;
}

/** Misses (rating ≤ 2) in the last `windowDays`, summarized for the planning sheet. */
async function recentWeakSpots(
  batchItemIds: string[],
  now: Date,
  windowDays = 14,
): Promise<WeakSpots> {
  const since = new Date(now.getTime() - windowDays * 86400000);
  const misses = await prisma.reviewLog.findMany({
    where: { reviewedAt: { gte: since }, rating: { lte: 2 } },
    select: { itemId: true, errorTags: true },
    take: 200,
  });
  const tally = new Map<ErrorTag, number>();
  const byItem: Record<string, ErrorTag[]> = {};
  const inBatch = new Set(batchItemIds);
  for (const miss of misses) {
    for (const tag of parseErrorTags(miss.errorTags)) {
      tally.set(tag, (tally.get(tag) ?? 0) + 1);
      if (miss.itemId && inBatch.has(miss.itemId)) {
        const list = (byItem[miss.itemId] ??= []);
        if (!list.includes(tag)) list.push(tag);
      }
    }
  }
  return {
    topTags: [...tally.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2),
    byItem,
  };
}

function dedupeById(items: ItemLite[]): ItemLite[] {
  const seen = new Set<string>();
  const out: ItemLite[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** Fisher–Yates shuffle → a new array (leaves the input untouched). Diversifies the MASTERY pool. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function getDueBatch(
  now: Date = new Date(),
  maxItems?: number,
  focus?: FocusInput,
): Promise<DueBatch> {
  const settings = await getSettings();
  const today = await todayCounts(settings, now);

  // The grammar loop only ever schedules GRAMMAR items; VOCAB lives in its own pool (see the vocab
  // query below) so it can never crowd grammar. Every item filter here is kind-scoped for that reason.
  const [dueRows, freshRows, dueNow, upcoming, newBeyondLevels] = await Promise.all([
    prisma.srsState.findMany({
      where: {
        due: { lte: now },
        state: { not: 0 },
        item: { suspended: false, kind: GRAMMAR_KIND },
      },
      include: { item: true },
      orderBy: { due: 'asc' },
      take: 50,
    }),
    prisma.srsState.findMany({
      where: {
        state: 0,
        item: { suspended: false, kind: GRAMMAR_KIND, level: { in: settings.grammarLevels } },
      },
      include: { item: true },
      orderBy: { item: { createdAt: 'asc' } },
      take: 50,
    }),
    prisma.srsState.count({
      where: {
        due: { lte: now },
        state: { not: 0 },
        item: { suspended: false, kind: GRAMMAR_KIND },
      },
    }),
    prisma.srsState.findFirst({
      where: {
        due: { gt: now },
        state: { not: 0 },
        item: { suspended: false, kind: GRAMMAR_KIND },
      },
      orderBy: { due: 'asc' },
      select: { due: true },
    }),
    prisma.srsState.count({
      where: {
        state: 0,
        item: { suspended: false, kind: GRAMMAR_KIND, level: { notIn: settings.grammarLevels } },
      },
    }),
  ]);

  let due = dueRows.map((r) => toLite(r as SrsRow, false));
  let fresh = freshRows.map((r) => toLite(r as SrsRow, true));

  // Focused practice: matching items jump the queue. Merge them into the pools (the general
  // queries may have truncated them out) and expose learned-but-not-due ones as early reviews.
  let focusArg: { ids: Set<string>; ahead: ItemLite[]; fillFromFocusOnly?: boolean } | undefined;
  let focusMeta: FocusMeta | null = null;
  if (focus?.levels?.length || focus?.patterns?.length || focus?.weak || focus?.groupId) {
    const rows = await focusRows(focus, now);
    const focusDue = rows
      .filter((r) => r.state !== 0 && r.due <= now)
      .map((r) => toLite(r as SrsRow, false));
    const focusAhead = rows
      .filter((r) => r.state !== 0 && r.due > now)
      .map((r) => toLite(r as SrsRow, false));
    const focusFresh = rows.filter((r) => r.state === 0).map((r) => toLite(r as SrsRow, true));
    due = dedupeById([...focusDue, ...due]);
    fresh = dedupeById([...focusFresh, ...fresh]);
    // Whole-level focus (a level, no specific patterns) keeps scheduled slots pure to that level;
    // the tutor scaffolds the rest with lower grammar. Pattern-focus still gets general fillers.
    const levelFocusOnly = !!focus.levels?.length && !focus.patterns?.length && !focus.weak;
    focusArg = {
      ids: new Set(rows.map((r) => r.item.id)),
      ahead: focusAhead,
      fillFromFocusOnly: levelFocusOnly,
    };
    const haystacks = rows.map((r) =>
      `${r.item.expression} ${r.item.reading ?? ''} ${r.item.meaningVi}`.toLowerCase(),
    );
    const unmatched = (focus.patterns ?? []).filter(
      (p) => !haystacks.some((h) => h.includes(p.toLowerCase())),
    );
    // Split the leftovers: present-but-paused is NOT absent, and conflating them tells the learner to
    // add a pattern they already own.
    const suspendedPatterns = await suspendedFocusMatches(unmatched);
    const suspendedKeys = new Set(suspendedPatterns.map((s) => s.pattern));
    focusMeta = {
      ...focus,
      matched: rows.length,
      unmatchedPatterns: unmatched.filter((p) => !suspendedKeys.has(p)),
      suspendedPatterns,
    };
  }

  // MASTERY: acquisition queue empty FOR TODAY + a solid graduated pool → recombine those instead of
  // ending the day. "Empty for today" = no due reviews AND no new grammar servable — the in-level new
  // pool is drained OR the daily new-grammar cap is spent (the common case: a productive day hits the
  // cap while the store still holds patterns for tomorrow). Normal path only — an explicit focus
  // request has its own empty messaging.
  const newGrammarExhausted =
    freshRows.length === 0 || today.newGrammar >= settings.dailyNewGrammar;
  let masteryPool: ItemLite[] = [];
  if (!focusArg && dueNow === 0 && newGrammarExhausted) {
    const gradRows = await prisma.srsState.findMany({
      where: {
        state: 2,
        item: { suspended: false, kind: GRAMMAR_KIND, level: { in: settings.grammarLevels } },
      },
      include: { item: true },
      take: 500, // the whole graduated set (per user) — shuffled below, not ordered by due
    });
    if (gradRows.length >= MASTERY_MIN_GRADUATED) {
      // Shuffle so mastery ROTATES through the whole mastered set instead of drilling the same
      // lowest-stability (soonest-due) patterns every sentence — the learner asked for a VARIETY of
      // structures. Weaker patterns still surface over time (uniform sample), and a miss re-activates
      // one via submit_review, so the weakness detector stays intact.
      masteryPool = shuffle(gradRows).map((r) => toLite(r as SrsRow, false));
    }
  }

  // Due VOCAB words (demand-driven, revived 2026-07-11) — woven into the sentence on their OWN budget
  // (settings.vocabPerSentence), never a grammar slot. `due <= now` catches both new vocab (created
  // due immediately by add_vocab) and vocab reviews; NOT level-filtered (the user looked the word up
  // because they needed it, whatever its level). Skipped entirely when the knob is 0.
  let vocabPool: ItemLite[] = [];
  if (settings.vocabPerSentence > 0) {
    const vocabRows = await prisma.srsState.findMany({
      where: { due: { lte: now }, item: { suspended: false, kind: VOCAB_KIND } },
      include: { item: true },
      orderBy: { due: 'asc' },
      take: 20,
    });
    vocabPool = vocabRows.map((r) => toLite(r as SrsRow, r.state === 0));
  }

  const batch = pickBatch({
    due,
    fresh,
    mastery: masteryPool,
    vocab: vocabPool,
    settings,
    today,
    totalOverride: maxItems,
    focus: focusArg,
  });
  const batchIds = batch.items.map((i) => i.id);
  const [recentContexts, weakSpots] = await Promise.all([
    recentContextsFor(batchIds),
    recentWeakSpots(batchIds, now),
  ]);
  return {
    ...batch,
    // Narrowed on the way OUT (the sheet is re-sent every turn); pickBatch above still gets the full
    // object, since scheduling reads fields composition never needs.
    settings: toCompositionSettings(settings),
    today,
    dueNow,
    newAvailable: { grammar: fresh.length },
    focus: focusMeta,
    weakSpots,
    newBeyondLevels,
    nextDueAt: upcoming?.due ?? null,
    recentContexts,
  };
}

// ---------------- submit review ----------------

export interface RatingInput {
  itemId: string;
  rating: RatingValue;
  role?: ItemRole;
  /** Taxonomy slugs (lib/error-tags.ts) — expected when rating ≤ 2. */
  errorTags?: string[];
  /**
   * The CONFUSION PAIRS behind those tags, when the grader can name one. Optional forever: a tag with
   * no nameable pair (a dropped particle, a botched conjugation) is still a valid annotation.
   */
  errorDetail?: Confusion[];
}

export interface StageSentenceInput {
  direction: 'JA_VI' | 'VI_JA';
  sourceText: string;
  /** Claude's reference translation — committed NOW, before the user answers (anti-contamination). */
  suggested: string;
  /** 2–4-word topic tag (vi) for the novelty guard. */
  context?: string;
  exerciseType?: string;
  /** JA source re-annotated as 漢字[かな] for hover-furigana in the history card (JA_VI only). */
  sourceRuby?: string;
  /** VI→JA reference answer re-annotated as 漢字[かな] for hover-furigana on the JA answer (VI_JA only). */
  suggestedRuby?: string;
  /**
   * The grammar patterns woven into this sentence (the lô). Captured now so a viewed-but-unanswered
   * sentence can be finalized as all-Again (skipSentence) — patterns otherwise attach only at
   * submit_review. Roles mirror the batch; itemIds must match get_due_items.
   */
  items?: { itemId: string; role: ItemRole }[];
  /**
   * Grammar Claude KNOWINGLY used beyond the scheduled batch (declared scaffolding). Persisted as-is;
   * `classifyExtraPatterns` in lib/scaffolding.ts turns them into known / new / shared-available so the
   * turn can explain and offer without the learner having to ask. Capped by the tool's Zod schema.
   */
  extraPatterns?: string[];
  /**
   * QUIZ only — the target pattern plus its three distractors, as DATA. The server lays them out into
   * A-D itself (`lib/quiz-options.ts`) and returns the option line to display, so the answer's position
   * is not something the tutor decides or can drift on. Supplying them also gets the question
   * validated (four genuinely distinct options) before the learner ever sees it.
   */
  quiz?: { correct: string; distractors: string[] };
}

/**
 * Persist a composed sentence + its reference translation BEFORE the user answers, returning a
 * sentenceId. submitReview later fills in the answer/ratings against this row and reuses the STAGED
 * `suggested` — so the reference cannot be anchored on the user's attempt (docs/decisions.md
 * 2026-07-10). The row is "pending" until submitReview (userAnswer = '').
 */
export async function stageSentence(
  input: StageSentenceInput,
  now: Date = new Date(),
): Promise<{ sentenceId: string; quiz?: QuizOptions }> {
  // Build the quiz layout FIRST: an invalid set of options must fail before anything is persisted, so
  // a rejected question leaves no pending row behind for autoSkipStalePending to sweep up later.
  const quiz = input.quiz
    ? buildQuizOptions(input.quiz.correct, input.quiz.distractors)
    : undefined;

  // The RECORDED question includes the options the server just assigned. Claude is told not to write
  // them itself, so this is the only place they can enter the row — and until they did (measured
  // 2026-07-28: 35 of 35 quiz rows held the bare sentence), the question the learner actually answered
  // survived nowhere but the chat: unauditable, un-rerenderable, and with the answer's position
  // effectively unrecorded. `sourceRuby` gets the same suffix because it REPLACES sourceText wherever
  // furigana is on (`components/history/history-cards.tsx`) — appending to one and not the other would
  // hide the options from exactly the learners who have ruby enabled.
  const withOptions = (text: string | null | undefined) =>
    quiz && text?.trim() ? `${text}\n\n${quiz.line}` : text;

  // Staging a fresh sentence is a natural moment to retire any long-abandoned pending rows.
  await autoSkipStalePending(now);
  const sentenceId = randomUUID();
  await prisma.sentence.create({
    data: {
      id: sentenceId,
      direction: input.direction,
      context: input.context?.trim() || null,
      exerciseType: input.exerciseType ?? 'TRANSLATION',
      sourceText: withOptions(input.sourceText) ?? input.sourceText,
      sourceRuby: withOptions(input.sourceRuby?.trim() || null) || null,
      userAnswer: '', // pending marker — filled by submitReview once the user answers
      suggested: input.suggested,
      suggestedRuby: input.suggestedRuby?.trim() || null,
      stagedItems: input.items?.length ? JSON.stringify(input.items) : null,
      extraPatterns: input.extraPatterns?.length ? JSON.stringify(input.extraPatterns) : null,
      status: 'PENDING',
      createdAt: now,
    },
  });
  return quiz ? { sentenceId, quiz } : { sentenceId };
}

export interface SubmitReviewInput {
  /** id from a prior stage_sentence call — the question + reference are read from that staged row. */
  sentenceId: string;
  userAnswer: string;
  feedback?: string;
  score?: number;
  ratings: RatingInput[];
  /**
   * OPTIONAL observation about the learner, written by Claude and stored as the asserted half of the
   * student model (`lib/learner-notes.ts`). It rides THIS call rather than getting a tool of its own —
   * the PUSH law: a write Claude has to remember to make separately is a write that stops happening.
   */
  learnerNote?: LearnerNoteInput;
  /**
   * How many hints / meaning-questions the learner needed BEFORE answering this turn. Feeds the Easy
   * floor in `lib/rating-guard.ts`: an answer that needed help is Good at best, whatever the tutor
   * claims. Defaults to 0.
   */
  assists?: number;
}

export interface SubmitReviewResult {
  sentenceId: string;
  // Echoed back so the rendered result block can show đề / bạn dịch / bản dịch tham khảo side by side
  // (the server owns the display — Claude "forgetting" to show its reference translation is why).
  direction: 'JA_VI' | 'VI_JA';
  /**
   * Echoed for the SAME reason as `direction`: the result block is server-owned, and until 2026-07-27
   * it labelled every turn by direction alone — so a TEACH_BACK turn told the learner "Đề (Nhật →
   * Việt)" and called their EXPLANATION "Bạn dịch". Found by driving the lab, not by a unit test.
   */
  exerciseType: string;
  sourceText: string;
  userAnswer: string;
  suggested: string | null;
  items: {
    itemId: string;
    expression: string;
    rating: RatingValue;
    state: number;
    nextDue: Date;
    intervalDays: number;
  }[];
  // Echoed back so the rendered result block can show the /100 score Claude just sent. The score is
  // saved to the Sentence row (history renders it), but the "Kết quả lượt này" block is server-owned
  // and Claude copies it verbatim — so a score not echoed here silently vanishes from the chat even
  // though it lives in history (the 2026-07-25 fix).
  score: number | null;
  /**
   * One line per rating the server LOWERED (`lib/rating-guard.ts` — Easy that was not earned). Rendered
   * to the learner: a grade that silently differs from the one the tutor announced reads as a bug, and
   * seeing WHY Easy became Good is the part that teaches.
   */
  ratingNotes: string[];
  today: TodayCounts;
  dueNow: number;
  /** Daily sentence goal (settings.sessionGoal) — rendered as "câu X/goal" progress. */
  sessionGoal: number;
  /**
   * SHADOW MODE (2026-07-26, calibration plan Phase 1). What the controller WOULD change, computed
   * from the ability estimate this turn just updated. Nothing is applied — it is surfaced so real
   * proposals can be judged before the controller is ever allowed to act (the 1.4 gate). `null` =
   * either not enough evidence yet, or the learner is inside the target band and nothing should move.
   */
  calibration: CalibrationShadow | null;
  /**
   * Outcome of the optional `learnerNote`, echoed so Claude learns WHY a note was refused (bad
   * evidence, too short, already said) instead of silently believing it landed. `null` = none sent.
   */
  learnerNote: RecordNoteResult | null;
  /**
   * TEACH_BACK turns only: the learner's own explanation, graded well, on a pattern that has no card
   * — offered as that card's usage line (plan step 7.3, decided in `coachTeachBack`). `null` on every
   * other exercise type and whenever the turn did not clear the bar.
   */
  teachBack: TeachBackHarvest | null;
}

/** One shadow proposal plus the numbers behind it, so it can be audited rather than trusted. */
export interface CalibrationShadow extends Proposal {
  /** Ability on the axis after this turn, in Elo points. */
  ability: number;
  /** Graded observations on that axis so far. */
  observations: number;
}

/**
 * Persist a shadow proposal so gate 1.4 has something to review.
 *
 * Append-only, and a PASSENGER: a failure here must never cost the learner the FSRS write they earned
 * (the same rule the calibration computation and the learner note already follow). It records the
 * numbers AS THEY WERE — `LearnerAbility` moves every turn, so reading it back later would show who
 * the learner is now, not what this proposal actually stood on.
 */
export async function recordCalibrationProposal(
  shadow: CalibrationShadow,
  sentenceId: string | null,
  now: Date = new Date(),
): Promise<void> {
  await prisma.calibrationProposal.create({
    data: {
      target: shadow.target,
      direction: shadow.direction,
      fromValue: String(shadow.from),
      toValue: String(shadow.to),
      axis: shadow.axis,
      measured: shadow.measured,
      ability: shadow.ability,
      observations: shadow.observations,
      reason: shadow.reason,
      sentenceId,
      createdAt: now,
    },
  });
}

export interface StoredProposal {
  id: string;
  target: string;
  direction: string;
  fromValue: string;
  toValue: string;
  axis: string;
  measured: number;
  ability: number;
  observations: number;
  reason: string;
  sentenceId: string | null;
  createdAt: Date;
  verdict: string | null;
}

/** The gate's read: this learner's proposals, newest first. */
export async function listCalibrationProposals(
  limit = 50,
): Promise<StoredProposal[]> {
  return prisma.calibrationProposal.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * The GATE's answer, recorded rather than remembered. Gate 1.4 asks whether a week of proposals "read
 * as wrong"; without a verdict column that question is settled by whoever remembers the conversation
 * best. Scoped by userId so one member can never grade another's controller.
 */
export async function setProposalVerdict(
  id: string,
  verdict: 'agree' | 'disagree',
): Promise<boolean> {
  const { count } = await prisma.calibrationProposal.updateMany({
    where: { id },
    data: { verdict },
  });
  return count > 0;
}

// ---------------- calibration (ability/challenge estimation — NEVER FSRS) ----------------

/** Which LearnerAbility columns hold each axis. Keeps the column names in exactly one place. */
/** The single ability row's fixed primary key (see prisma/schema.prisma → LearnerAbility). */
const ABILITY_ROW_ID = 'singleton';

const ABILITY_COLUMNS = {
  receptive: { rating: 'abilityReceptive', observations: 'receptiveObservations' },
  productive: { rating: 'abilityProductive', observations: 'productiveObservations' },
  register: { rating: 'abilityRegister', observations: 'registerObservations' },
} as const satisfies Record<AbilityAxis, { rating: string; observations: string }>;

/**
 * Load the learner's ability row, seeding it from their OWN SETTINGS on first use
 * (`initialAbility`) rather than from a global default — the settings page is the trusted prior, so
 * the controller starts by agreeing with the learner and can only diverge on evidence.
 */
async function getOrSeedAbility(settings: Settings) {
  const existing = await prisma.learnerAbility.findFirst();
  if (existing) return existing;
  const seed = initialAbility(settings);
  return prisma.learnerAbility.create({
    data: {
      abilityReceptive: seed,
      abilityProductive: seed,
      abilityRegister: seed,
    },
  });
}

/** How far back the rolling success estimate and the engagement check look. */
const CALIBRATION_LOG_WINDOW = 60;
const ENGAGEMENT_WINDOW_DAYS = 7;

/**
 * SHADOW MODE: compute what the controller WOULD propose. Reads only; applies nothing.
 *
 * Everything here is measurement the app was already recording and never reading back: ratings, the
 * sentence's direction and exerciseType. The point of Phase 1 is to accumulate REAL proposals so the
 * learner can judge them before the controller is ever allowed to act.
 */
async function computeCalibrationShadow(
  axis: AbilityAxis,
  ability: number,
  observations: number,
  settings: Settings,
  now: Date,
): Promise<CalibrationShadow | null> {
  const logs = await prisma.reviewLog.findMany({
    orderBy: { reviewedAt: 'desc' },
    take: CALIBRATION_LOG_WINDOW,
    select: {
      rating: true,
      reviewedAt: true,
      sentence: { select: { direction: true, exerciseType: true } },
    },
  });

  // Oldest-first, because successEstimate treats the tail as "most recent".
  const chronological = [...logs].reverse();
  const onAxis = chronological.filter(
    (l) =>
      l.sentence
        ? axesFor(l.sentence.direction, l.sentence.exerciseType).includes(axis)
        : axis === 'receptive', // a legacy log with no sentence: treat as the default reading task
  );
  const estimate = successEstimate(onAxis.map((l) => RATING_OUTCOME[l.rating as RatingValue] ?? 0));

  // The rung the learner is actually practising production at right now = the most recent production
  // turn's exerciseType. No production history yet → assume the unassisted rung, which is what
  // `direction` alone used to mean.
  const lastProduction = [...chronological]
    .reverse()
    .find(
      (l) =>
        l.sentence && axesFor(l.sentence.direction, l.sentence.exerciseType).includes('productive'),
    );
  const lastType = lastProduction?.sentence?.exerciseType ?? '';
  const currentRung: Rung = (RUNG_ORDER as readonly string[]).includes(lastType)
    ? (lastType as Rung)
    : 'TRANSLATION';

  // Engagement as a VETO, never a target: derived from the same rows, so no extra query. A learner
  // doing fewer turns than the previous week never gets a harder exercise proposed.
  const dayMs = 86_400_000;
  const recentCutoff = now.getTime() - ENGAGEMENT_WINDOW_DAYS * dayMs;
  const priorCutoff = now.getTime() - 2 * ENGAGEMENT_WINDOW_DAYS * dayMs;
  const recentTurns = chronological.filter((l) => l.reviewedAt.getTime() >= recentCutoff).length;
  const priorTurns = chronological.filter(
    (l) => l.reviewedAt.getTime() >= priorCutoff && l.reviewedAt.getTime() < recentCutoff,
  ).length;
  const engagementFalling = priorTurns > 0 && recentTurns < priorTurns;

  const proposal = proposeAdjustment({
    axis,
    estimate,
    settings,
    currentRung,
    engagementFalling,
  });
  return proposal ? { ...proposal, ability, observations } : null;
}

export async function submitReview(
  input: SubmitReviewInput,
  now: Date = new Date(),
): Promise<SubmitReviewResult> {
  const settings = await getSettings();

  // The sentence + reference translation were committed by stage_sentence BEFORE the user answered.
  // Scoped by userId so a member can only grade their OWN staged sentence (a foreign/typo'd id reads
  // as "not found", never another user's row).
  const sentence = await prisma.sentence.findUnique({
    where: { id: input.sentenceId },
  });
  if (!sentence) {
    throw new Error(
      `sentenceId không tồn tại: "${input.sentenceId}". KHÔNG tự đặt id — phải dùng ĐÚNG chuỗi sentenceId ` +
        `mà stage_sentence đã trả về cho câu này. Nếu chưa có, hãy gọi stage_sentence (ghi câu đề + bản dịch mẫu) ` +
        `để lấy sentenceId rồi mới submit_review.`,
    );
  }
  // Only a GRADED row is truly final. Guarding on `userAnswer` (truthy) instead used to reject a
  // sentence that a concurrent autoSkipStalePending had flipped to SKIPPED (it writes a placeholder
  // userAnswer) — a late answer after the 1h window then hit "đã chấm rồi" and lost the ratings. A
  // PENDING or SKIPPED row may still be graded; the STAGED reference (suggested) is reused either way.
  if (sentence.status === 'GRADED') {
    throw new Error(
      `câu ${input.sentenceId} đã được chấm rồi — không gọi submit_review lần hai (rating chung thẩm)`,
    );
  }

  // Dedupe ratings (one signal per item per sentence).
  const unique = new Map<string, RatingInput>();
  for (const r of input.ratings) if (!unique.has(r.itemId)) unique.set(r.itemId, r);
  const ratings = [...unique.values()];
  if (ratings.length === 0) throw new Error('ratings trống — cần ít nhất 1 item');

  // Integrity: a rating must belong to the batch that was staged for THIS sentence. Without this, a
  // stray/duplicate stage_sentence or a hallucinated-but-existing itemId could write an FSRS review
  // against an unrelated sentence (the "sole write path" otherwise trusts the model blindly). Legacy
  // rows (pre-2026-07-11) carry no stagedItems → skip the check for them (lenient, backward-compatible).
  const staged = parseStagedItems(sentence.stagedItems);
  if (staged.length > 0) {
    const stagedIds = new Set(staged.map((s) => s.itemId));
    const stray = ratings.filter((r) => !stagedIds.has(r.itemId)).map((r) => r.itemId);
    if (stray.length > 0) {
      throw new Error(
        `itemId không thuộc câu ${input.sentenceId}: ${stray.join(', ')} — chỉ chấm các mẫu đã stage ` +
          `cho câu này (dùng đúng itemId mà stage_sentence đã ghi trong items).`,
      );
    }
  }

  const states = await prisma.srsState.findMany({
    where: { itemId: { in: ratings.map((r) => r.itemId) } },
    include: { item: true },
  });
  const byItemId = new Map(states.map((s) => [s.itemId, s]));
  const missing = ratings.filter((r) => !byItemId.has(r.itemId)).map((r) => r.itemId);
  if (missing.length > 0) {
    throw new Error(
      `itemId không tồn tại: ${missing.join(', ')} — dùng đúng itemId từ get_due_items/list_grammar/list_vocab`,
    );
  }

  const sentenceId = sentence.id;
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.sentence.update({
      where: { id: sentenceId },
      data: {
        userAnswer: input.userAnswer,
        feedback: input.feedback ?? null,
        score: input.score ?? null,
        status: 'GRADED',
        answeredAt: now, // time-to-answer = answeredAt − createdAt (analytics)
      },
    }),
  ];
  const resultItems: SubmitReviewResult['items'] = [];

  // ── Calibration (lib/calibration.ts). Rides the SAME transaction as the FSRS write so the ability
  // estimate can never drift out of step with the reviews it was derived from. It writes ONLY its own
  // columns (Item.challenge, LearnerAbility) — never SrsState, so invariant 1 holds: submit_review is
  // still the one FSRS write path, and calibration is a passenger on it, not a second scheduler.
  const ability = await getOrSeedAbility(settings);
  const axes = axesFor(sentence.direction, sentence.exerciseType);
  const primaryAxis = axes[0];
  // Per-axis running values, so several ratings in ONE turn compound correctly instead of each
  // overwriting the last.
  const running: Record<AbilityAxis, { rating: number; observations: number }> = {
    receptive: {
      rating: ability.abilityReceptive,
      observations: ability.receptiveObservations,
    },
    productive: {
      rating: ability.abilityProductive,
      observations: ability.productiveObservations,
    },
    register: { rating: ability.abilityRegister, observations: ability.registerObservations },
  };

  // ── The Easy floor (lib/rating-guard.ts). Applied HERE, on the sole FSRS write path, because any
  // rating that reaches rateOnce is a rating the scheduler believes. Elapsed time is measured from the
  // staged row's createdAt — the moment the question was shown — which is why it cannot be
  // self-reported away.
  const elapsedSec = (now.getTime() - sentence.createdAt.getTime()) / 1000;
  const evidence = {
    elapsedSec,
    assists: input.assists ?? 0,
    exerciseType: sentence.exerciseType,
  };
  const ratingNotes: string[] = [];

  for (const { itemId, rating: claimedRating, role, errorTags, errorDetail } of ratings) {
    const state = byItemId.get(itemId)!;
    const verdict = earnedRating(claimedRating as Rating, evidence);
    const rating = verdict.rating;
    if (verdict.downgradedFrom) {
      ratingNotes.push(`${state.item.expression}: Easy → Good (${verdict.reason})`);
    }
    const { next, log } = rateOnce(state, rating, {
      retention: settings.desiredRetention,
      now,
    });
    // One Elo match per rated item, on every axis this exercise is evidence for. A null challenge
    // means "never measured" → seed it from the item's JLPT level (real prior info, not a guess).
    const itemChallenge = state.item.challenge ?? initialChallenge(state.item.level);
    let challengeAfter = itemChallenge;
    for (const axis of axes) {
      const cur = running[axis];
      const updated = updateElo(
        {
          ability: cur.rating,
          challenge: itemChallenge,
          abilityObservations: cur.observations,
          challengeObservations: state.item.challengeObservations,
        },
        rating,
        sentence.exerciseType,
      );
      cur.rating = updated.ability;
      cur.observations += 1;
      // The item's challenge follows the PRIMARY axis only — a CONVERSATION turn is evidence about
      // the learner on two axes, but the item is still just one task.
      if (axis === primaryAxis) challengeAfter = updated.challenge;
    }
    writes.push(
      prisma.item.update({
        where: { id: itemId },
        data: {
          challenge: challengeAfter,
          challengeObservations: state.item.challengeObservations + 1,
        },
      }),
    );
    writes.push(
      prisma.srsState.update({ where: { itemId }, data: { ...next } }),
      prisma.reviewLog.create({
        data: {
          errorTags: errorTags?.length ? JSON.stringify(errorTags) : null,
          errorDetail: serializeErrorDetail(errorDetail),
          itemId,
          rating: log.rating,
          state: log.state,
          role: role ?? 'TARGET',
          due: log.due,
          stability: log.stability,
          difficulty: log.difficulty,
          reviewedAt: now,
          sentenceId,
        },
      }),
    );
    resultItems.push({
      itemId,
      expression: state.item.expression,
      rating,
      state: next.state,
      nextDue: next.due,
      intervalDays: Math.max(0, Math.round((next.due.getTime() - now.getTime()) / 86400000)),
    });
  }

  writes.push(
    prisma.learnerAbility.update({
      where: { id: ABILITY_ROW_ID },
      data: {
        [ABILITY_COLUMNS.receptive.rating]: running.receptive.rating,
        [ABILITY_COLUMNS.receptive.observations]: running.receptive.observations,
        [ABILITY_COLUMNS.productive.rating]: running.productive.rating,
        [ABILITY_COLUMNS.productive.observations]: running.productive.observations,
        [ABILITY_COLUMNS.register.rating]: running.register.rating,
        [ABILITY_COLUMNS.register.observations]: running.register.observations,
      },
    }),
  );

  await prisma.$transaction(writes);
  invalidateStreak(); // a fresh review may tick the streak up — drop the cache so the beacon sees it

  const [today, dueNow, calibration, learnerNote] = await Promise.all([
    todayCounts(settings, now),
    // GRAMMAR-scoped like every other due-count (getDueBatch/getStats): the "Kết quả lượt này" block's "còn N mẫu đến
    // hạn" is the grammar queue — due VOCAB rides its own budget and must never inflate it (anti-N5-drag).
    prisma.srsState.count({
      where: {
        due: { lte: now },
        state: { not: 0 },
        item: { suspended: false, kind: GRAMMAR_KIND },
      },
    }),
    // SHADOW ONLY: runs AFTER the write so it sees the ability this turn just produced, and returns a
    // proposal nobody applies. A failure here must never fail a graded review — the review is the
    // user's work, calibration is a bystander.
    computeCalibrationShadow(
      primaryAxis,
      running[primaryAxis].rating,
      running[primaryAxis].observations,
      settings,
      now,
    ).catch(() => null),
    // Same bystander rule as calibration: the note is a passenger. A rejected or failing note must
    // never cost the learner the FSRS write they actually earned this turn.
    input.learnerNote
      ? recordLearnerNote(input.learnerNote, now).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Persist the shadow proposal, if there was one. Same passenger rule again — and the reason it must
  // be persisted AT ALL: gate 1.4 of the calibration plan requires a week of proposals to be reviewed
  // before Phase 3 may auto-apply anything, and until this existed a proposal was rendered into the
  // tool result and then gone. `LearnerAbility` overwrites in place, so nothing survived the turn: the
  // gate that makes the plan falsifiable had no evidence to read.
  if (calibration) {
    await recordCalibrationProposal(calibration, input.sentenceId, now).catch(() => null);
  }


  // TEACH-BACK HARVEST (plan step 7.3). The DECISION is pure and lives in lib/coach.ts; everything it
  // reads was already loaded for the FSRS write, so this costs no extra query. Only the TARGET counts:
  // a teach-back turn grades ONE explanation, and a filler item's rating says nothing about it.
  const target =
    sentence.exerciseType === TEACH_BACK_EXERCISE
      ? (ratings.find((r) => r.role === 'TARGET') ?? (ratings.length === 1 ? ratings[0] : null))
      : null;
  const targetItem = target ? byItemId.get(target.itemId)?.item : null;
  const teachBack =
    target && targetItem
      ? coachTeachBack({
          itemId: targetItem.id,
          expression: targetItem.expression,
          rating: target.rating,
          explanation: input.userAnswer,
          hasCard: Boolean(targetItem.enrichment?.trim()),
        })
      : null;

  return {
    sentenceId,
    direction: sentence.direction as 'JA_VI' | 'VI_JA',
    exerciseType: sentence.exerciseType,
    sourceText: sentence.sourceText,
    userAnswer: input.userAnswer,
    suggested: sentence.suggested, // the STAGED reference — committed before the user answered
    items: resultItems,
    score: input.score ?? null, // echo Claude's /100 score back so the result block can show it
    today,
    dueNow,
    sessionGoal: settings.sessionGoal,
    calibration,
    learnerNote,
    teachBack,
    ratingNotes,
  };
}

/** Parse a Sentence.stagedItems JSON blob leniently → [] on any malformed/missing data. */
function parseStagedItems(raw: string | null): { itemId: string; role?: ItemRole }[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is { itemId: string; role?: ItemRole } => {
        return (
          typeof x === 'object' &&
          x !== null &&
          typeof (x as { itemId?: unknown }).itemId === 'string'
        );
      })
      .map((x) => ({ itemId: x.itemId, role: x.role }));
  } catch {
    return [];
  }
}

/**
 * Skip a PENDING (staged, not-answered) sentence: the user chose to move on without translating.
 * The row is KEPT (status SKIPPED) with its frozen reference so it stays in history for audit, but a
 * skip is NOT a review signal — it writes NOTHING to FSRS / ReviewLog (changed 2026-07-14: skip used
 * to rate every pattern all-Again, which unfairly punished the schedule for a sentence the user simply
 * didn't attempt). No-op-safe: rejects a non-pending sentence. Returns how many patterns the skipped
 * sentence carried (informational only — none were rated).
 */
export async function skipSentence(
  sentenceId: string,
): Promise<{ skipped: number }> {
  const sentence = await prisma.sentence.findUnique({ where: { id: sentenceId } });
  if (!sentence) throw new Error(`sentenceId không tồn tại: "${sentenceId}"`);
  if (sentence.status !== 'PENDING') {
    throw new Error(`câu ${sentenceId} không ở trạng thái chờ (status=${sentence.status})`);
  }
  const staged = parseStagedItems(sentence.stagedItems);
  await prisma.sentence.update({
    where: { id: sentenceId },
    data: { userAnswer: '(bỏ qua — không tính FSRS)', status: 'SKIPPED' },
  });
  return { skipped: staged.length };
}

/** How long a staged sentence may sit unanswered before it is auto-skipped. */
const PENDING_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Sweep PENDING sentences older than `maxAgeMs` into SKIPPED (kept, NOT counted by FSRS) so history
 * doesn't pile up stale "đang chờ" rows for questions the user never came back to. There is no
 * background scheduler in this local-first app, so this runs opportunistically on a read
 * (listSentences) and a write (stageSentence) — an open history page also self-heals via its 10s poll.
 * Returns how many rows were auto-skipped.
 */
export async function autoSkipStalePending(
  now: Date = new Date(),
  maxAgeMs: number = PENDING_MAX_AGE_MS,
): Promise<{ autoSkipped: number }> {
  const cutoff = new Date(now.getTime() - maxAgeMs);
  const result = await prisma.sentence.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data: { userAnswer: '(quá hạn — tự bỏ qua)', status: 'SKIPPED' },
  });
  return { autoSkipped: result.count };
}

// ---------------- stats & management ----------------

// Streak cache — the app-wide beacon polls getStreak every ~10s, which otherwise re-scans the whole
// ReviewLog per call. Cache the computed streak per user, guarded by the study-day it was computed for
// (so it self-refreshes across the day boundary) with a short TTL to bound intra-day staleness; and bust
// it the instant a review is written, so a fresh review still fires the celebration promptly. In-memory /
// single-process is fine — the app runs as one container.
const STREAK_TTL_MS = 60_000;
let streakCache: { value: Streak; dayKey: string; at: number } | null = null;

/**
 * Drop the cached streak — called on the FSRS write path so the next poll recomputes.
 *
 * Exported because the cache is now a single module-level value (it was a per-user Map while the app
 * was multi-user, where a new user always missed it). Anything that changes ReviewLog WITHOUT going
 * through submitReview — a backup restore, a test clearing tables — has to say so.
 */
export function invalidateStreak(): void {
  streakCache = null;
}

/**
 * Distinct-study-day streak for a user, served from cache when fresh. The single source of truth shared
 * by getStats (dashboard) and getStreak (the 10s beacon) so they can never disagree. On a miss it does the
 * one narrow full scan of ReviewLog.reviewedAt that computeStreak needs (longest run spans all history).
 */
async function studyStreak(cutoffHour: number, now: Date): Promise<Streak> {
  const dayKey = studyDayKey(now, cutoffHour);
  const hit = streakCache;
  if (hit && hit.dayKey === dayKey && now.getTime() - hit.at < STREAK_TTL_MS) return hit.value;
  const reviewDates = await prisma.reviewLog.findMany({
    select: { reviewedAt: true },
  });
  const value = computeStreak(
    reviewDates.map((r) => studyDayKey(r.reviewedAt, cutoffHour)),
    dayKey,
  );
  streakCache = { value, dayKey, at: now.getTime() };
  return value;
}

export async function getStats(now: Date = new Date()) {
  const settings = await getSettings();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekAhead = new Date(now.getTime() + 7 * 86400000);
  const [totalItems, newItems, dueNow, reviews7d, dueSoon, weakRows, stateRows, suspended, today] =
    await Promise.all([
      // The "Tiến độ" dashboard is the GRAMMAR overview (kho ngữ pháp) — item counts are
      // kind-scoped so revived vocab never inflates them. Review activity (reviews7d, today) spans
      // all reviews on purpose: a review is a review for the streak/activity, grammar or vocab.
      prisma.item.count({ where: { kind: GRAMMAR_KIND } }),
      prisma.srsState.count({
        where: { state: 0, item: { suspended: false, kind: GRAMMAR_KIND } },
      }),
      prisma.srsState.count({
        where: {
          due: { lte: now },
          state: { not: 0 },
          item: { suspended: false, kind: GRAMMAR_KIND },
        },
      }),
      prisma.reviewLog.count({ where: { reviewedAt: { gte: weekAgo } } }),
      prisma.srsState.findMany({
        where: {
          due: { gt: now, lte: weekAhead },
          state: { not: 0 },
          item: { suspended: false, kind: GRAMMAR_KIND },
        },
        select: { due: true },
      }),
      prisma.srsState.findMany({
        where: {
          reps: { gt: 0 },
          lapses: { gt: 0 },
          item: { suspended: false, kind: GRAMMAR_KIND },
        },
        include: { item: { select: { expression: true, meaningVi: true } } },
        orderBy: [{ lapses: 'desc' }, { stability: 'asc' }],
        take: 5,
      }),
      prisma.srsState.groupBy({
        by: ['state'],
        where: { item: { suspended: false, kind: GRAMMAR_KIND } },
        _count: true,
      }),
      prisma.item.count({ where: { suspended: true, kind: GRAMMAR_KIND } }),
      todayCounts(settings, now),
    ]);

  const forecast: Record<string, number> = {};
  for (const s of dueSoon) {
    const key = s.due.toISOString().slice(0, 10);
    forecast[key] = (forecast[key] ?? 0) + 1;
  }

  // Mastery mix by FSRS state (suspended pulled out) — feeds the dashboard breakdown bar.
  const byState = new Map(stateRows.map((r) => [r.state, r._count]));
  const mastery = {
    new: byState.get(0) ?? 0,
    learning: byState.get(1) ?? 0,
    review: byState.get(2) ?? 0,
    relearning: byState.get(3) ?? 0,
    suspended,
  };

  // Streak from distinct study days (cached; the 10s beacon path shares the same source of truth).
  const streak = await studyStreak(settings.dayCutoffHour, now);

  // Reviews per study-day for the last 7 days (oldest → newest) — the activity bar chart. Bounded to an
  // 8-day window (covers all 7 buckets even at a 23h cutoff) instead of re-scanning all of history; the
  // streak scan above is the only full one, and it is cached.
  const windowStart = new Date(now.getTime() - 8 * 86400000);
  const recentReviews = await prisma.reviewLog.findMany({
    where: { reviewedAt: { gte: windowStart } },
    select: { reviewedAt: true },
  });
  const dayTally = new Map<string, number>();
  for (const r of recentReviews) {
    const k = studyDayKey(r.reviewedAt, settings.dayCutoffHour);
    dayTally.set(k, (dayTally.get(k) ?? 0) + 1);
  }
  const reviewsByDay = Array.from({ length: 7 }, (_, i) => {
    const key = studyDayKey(new Date(now.getTime() - (6 - i) * 86400000), settings.dayCutoffHour);
    return { day: key.slice(5), count: dayTally.get(key) ?? 0 };
  });

  return {
    totalItems,
    newItems,
    dueNow,
    today,
    streak,
    reviewsLast7Days: reviews7d,
    dueForecast7Days: forecast,
    reviewsByDay,
    mastery,
    weakItems: weakRows.map((s) => ({
      itemId: s.itemId,
      expression: s.item.expression,
      meaningVi: s.item.meaningVi,
      lapses: s.lapses,
      reps: s.reps,
    })),
    settings,
  };
}

export type Stats = Awaited<ReturnType<typeof getStats>>;

export interface ListItemsFilter {
  level?: string;
  search?: string;
  suspended?: boolean;
  /** true = only enriched items; false = only items still missing an enrichment card. */
  enriched?: boolean;
  /**
   * Filter by CARD QUALITY (lib/enrichment-quality.ts), which `enriched` cannot express: a one-line
   * card and a complete one were both "enriched: true" forever. `needs-work` = any of
   * missing/broken/thin/outdated — the sweep's target list.
   *
   * Applied in JS, not SQL: the tier is computed from the JSON blob. See the widened fetch below.
   */
  quality?: QualityTier | 'needs-work';
  /** Which item kind to browse — defaults to GRAMMAR (list_grammar passes GRAMMAR, list_vocab VOCAB). */
  kind?: string;
  /** Only items belonging to this study group (GroupMember join). Undefined = no group filter. */
  groupId?: string;
  limit?: number;
}

export async function listItems(filter: ListItemsFilter = {}) {
  const items = await prisma.item.findMany({
    where: {
      kind: filter.kind ?? GRAMMAR_KIND,
      level: filter.level,
      suspended: filter.suspended,
      ...(filter.enriched === true ? { enrichment: { not: null } } : {}),
      ...(filter.enriched === false ? { enrichment: null } : {}),
      ...(filter.groupId ? { groups: { some: { groupId: filter.groupId } } } : {}),
      ...(filter.search
        ? {
            OR: [
              { expression: { contains: filter.search } },
              { reading: { contains: filter.search } },
              { meaningVi: { contains: filter.search } },
            ],
          }
        : {}),
    },
    include: {
      srs: {
        select: {
          state: true,
          due: true,
          reps: true,
          lapses: true,
          stability: true,
          difficulty: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    // A quality filter cannot run in SQL (the tier comes out of the JSON blob), so the LIMIT must be
    // applied AFTER scoring — taking `limit` rows first would filter a page instead of the library and
    // silently under-report. Bounded so this can never become an unbounded scan.
    take: filter.quality ? QUALITY_SCAN_CAP : (filter.limit ?? 50),
  });
  const scoped = filter.quality
    ? items
        .filter((i) => {
          const tier = scoreEnrichment(i.enrichment).tier;
          return filter.quality === 'needs-work' ? needsWork(tier) : tier === filter.quality;
        })
        .slice(0, filter.limit ?? 50)
    : items;
  return scoped.map((i) => ({
    itemId: i.id,
    expression: i.expression,
    reading: i.reading,
    hanviet: i.hanviet,
    meaningVi: i.meaningVi,
    level: i.level,
    notes: i.notes,
    captureReason: i.captureReason as VocabCaptureReason | null,
    suspended: i.suspended,
    starred: i.starred,
    enrichment: i.enrichment,
    enrichedAt: i.enrichedAt,
    createdAt: i.createdAt,
    srs: i.srs,
  }));
}

/**
 * The current study-day streak ONLY — a light query (distinct review days) for the app-wide streak
 * celebration beacon, which polls this on every page so the fire can fire wherever the user is when the
 * streak ticks up. Reuses the same computeStreak logic as the dashboard (one source of truth).
 */
export async function getStreak(): Promise<{ current: number; longest: number }> {
  const settings = await getSettings();
  return studyStreak(settings.dayCutoffHour, new Date());
}

// ---------------- quiz ----------------

export interface QuizItem {
  itemId: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  notes: string | null;
  level: string;
  enrichment: Enrichment | null;
  isNew: boolean;
}

export interface QuizBatch {
  kind: string;
  count: number;
  items: QuizItem[];
  /**
   * Real patterns from the learner's own library that are genuinely confusable with the FIRST item —
   * its own `contrasts`, plus every card that names it as a contrast (the reverse link, which no card
   * lists about itself). Curated data: prefer these as distractors.
   */
  contrastCandidates: string[];
  /**
   * Weaker fallback: other unsuspended patterns at the same JLPT level. Only for topping up, and only
   * when one is actually confusable in the sentence being written — a random same-level pattern makes
   * an obviously-wrong option, which is its own kind of broken question.
   */
  sameLevelCandidates: string[];
}

/**
 * Distractor candidates for one target pattern, best tier first.
 *
 * The reverse-contrast scan is the interesting half. A card lists what IT is confused with, so the
 * target's own `contrasts` see only one direction; if 〜しかない's card names 〜ざるを得ない, then
 * 〜ざるを得ない is confusable with 〜しかない even though its own card never says so. Recovering those
 * links roughly doubles the curated pool at no authoring cost — which matters because the measured
 * average is 1.6 contrasts per card against the 3 distractors a question needs.
 */
async function distractorCandidatesFor(
  kind: string,
  target: { id: string; expression: string; level: string; enrichment: Enrichment | null },
): Promise<{ contrastCandidates: string[]; sameLevelCandidates: string[] }> {
  const own = (target.enrichment?.contrasts ?? []).map((c) => c.with);

  // LIKE on the DECORATION-STRIPPED core: the library stores 「〜わけにはいかない」 but a contrast may be
  // written without the tilde, and matching the raw expression would silently find nothing.
  const core = stripDecoration(target.expression);
  const reverse: string[] = [];
  if (core.length >= 2) {
    const rows = await prisma.item.findMany({
      where: {
        kind,
        suspended: false,
        id: { not: target.id },
        enrichment: { contains: core },
      },
      select: { expression: true, enrichment: true },
      take: 40,
    });
    for (const row of rows) {
      // `contains` can hit the target's name anywhere in the blob (a usage note, an example). Only a
      // genuine contrast link counts, so re-check the parsed field rather than trusting the LIKE.
      const names = (parseEnrichment(row.enrichment)?.contrasts ?? []).map((c) => c.with);
      if (names.some((n) => sameExpression(n, target.expression))) reverse.push(row.expression);
    }
  }

  const sameLevel = await prisma.item.findMany({
    where: { kind, suspended: false, level: target.level, id: { not: target.id } },
    select: { expression: true },
    orderBy: { createdAt: 'desc' },
    take: MAX_DISTRACTOR_CANDIDATES * 2,
  });

  const contrastCandidates = mergeDistractorCandidates(target.expression, [own, reverse]);
  const sameLevelCandidates = mergeDistractorCandidates(target.expression, [
    sameLevel.map((r) => r.expression),
    contrastCandidates, // dropped by the dedup — keeps the two lists disjoint
  ]).filter((e) => !contrastCandidates.some((c) => sameExpression(c, e)));

  return { contrastCandidates, sameLevelCandidates };
}

/**
 * Pick item(s) for a QUIZ question — normally count=1 (one grammar pattern → one fill-in-the-blank).
 * Due items first (FSRS order), topped up with new items (grammar new stays within settings.grammarLevels).
 * Reuses the SAME items + FSRS state as the translate loop — quiz just presents a pattern as a cloze the
 * learner types into. Rating flows through submit_review. Enrichment is parsed so Claude writes a correct
 * sentence + can explain contrasts. (Claude is told to pick randomly among the returned items.)
 */
export async function getQuizBatch(
  kind: string,
  count: number,
  now: Date = new Date(),
): Promise<QuizBatch> {
  const n = Math.max(1, Math.min(3, count));
  const settings = await getSettings();
  const dueRows = await prisma.srsState.findMany({
    where: { due: { lte: now }, state: { not: 0 }, item: { suspended: false, kind } },
    include: { item: true },
    orderBy: { due: 'asc' },
    take: n,
  });
  const picked: { item: (typeof dueRows)[number]['item']; isNew: boolean }[] = dueRows.map((s) => ({
    item: s.item,
    isNew: false,
  }));
  if (picked.length < n) {
    const newItems = await prisma.item.findMany({
      where: {
        kind,
        suspended: false,
        srs: { state: 0 },
        ...(kind === GRAMMAR_KIND ? { level: { in: settings.grammarLevels } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: n - picked.length,
    });
    for (const item of newItems) picked.push({ item, isNew: true });
  }
  const first = picked[0]?.item;
  const candidates = first
    ? await distractorCandidatesFor(kind, {
        id: first.id,
        expression: first.expression,
        level: first.level,
        enrichment: parseEnrichment(first.enrichment),
      })
    : { contrastCandidates: [], sameLevelCandidates: [] };
  return {
    kind,
    count: picked.length,
    ...candidates,
    items: picked.map(({ item, isNew }) => ({
      itemId: item.id,
      expression: item.expression,
      reading: item.reading,
      meaningVi: item.meaningVi,
      notes: item.notes,
      level: item.level,
      enrichment: parseEnrichment(item.enrichment),
      isNew,
    })),
  };
}

export interface EnrichmentInput {
  itemId: string;
  enrichment: unknown; // validated by enrichmentSchema at the tool boundary
}

/** Store Claude-generated enrichment cards. Unknown itemIds are reported, not fatal. */
export async function saveEnrichments(
  inputs: { itemId: string; enrichmentJson: string }[],
): Promise<{ updated: number; missing: string[] }> {
  const now = new Date();
  // One existence probe for the whole batch (was a findUnique PER input — the N+1), then all updates in a
  // single transaction. Same semantics as the old sequential loop: an unknown id lands in `missing`, a
  // known id is updated, and a duplicate id in the batch is last-write-wins (its update runs twice).
  const existing = new Set(
    (
      await prisma.item.findMany({
        where: { id: { in: inputs.map((i) => i.itemId) } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  const missing: string[] = [];
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const { itemId, enrichmentJson } of inputs) {
    if (!existing.has(itemId)) {
      missing.push(itemId);
      continue;
    }
    updates.push(
      prisma.item.update({
        where: { id: itemId },
        data: { enrichment: enrichmentJson, enrichedAt: now },
      }),
    );
  }
  if (updates.length > 0) await prisma.$transaction(updates);
  return { updated: updates.length, missing };
}

/** Upper bound on rows scored for a `quality` filter — bounded work, never a full-library scan. */
const QUALITY_SCAN_CAP = 500;

/** How far back error-signature mining looks. Older than this is history, not a current difficulty. */
export const CONFUSION_WINDOW_DAYS = 90;

/**
 * Review rows in the window that actually carry a confusion pair, for `lib/mining.ts`.
 *
 * Filtered to `errorDetail: { not: null }` in SQL rather than in JS: every row written before
 * 2026-07-27 has none, so without the filter this would scan the whole append-only log to find a
 * handful of rows.
 */
export async function listConfusionRows(
  now: Date = new Date(),
): Promise<ConfusionRow[]> {
  const since = new Date(now.getTime() - CONFUSION_WINDOW_DAYS * 86400000);
  const rows = await prisma.reviewLog.findMany({
    where: { reviewedAt: { gte: since }, errorDetail: { not: null } },
    select: {
      itemId: true,
      sentenceId: true,
      reviewedAt: true,
      errorDetail: true,
      item: { select: { expression: true } },
    },
    orderBy: { reviewedAt: 'desc' },
    take: 400,
  });
  return rows.map((r) => ({
    itemId: r.itemId,
    // Null when the item was deleted (invariant #2 keeps the log) — the pair still counts, it just
    // cannot be attached to a card.
    expression: r.item?.expression ?? null,
    sentenceId: r.sentenceId,
    reviewedAt: r.reviewedAt,
    confusions: parseErrorDetail(r.errorDetail),
  }));
}

export interface PatchEnrichmentInput {
  itemId: string;
  add?: EnrichmentAdd;
  set?: EnrichmentSet;
  /** Take the parts my card lacks from this PUBLIC item's card (coach code ENRICH_FROM_SHARED). */
  fromSharedItemId?: string;
}

export type PatchEnrichmentResult =
  | {
      patched: true;
      expression: string;
      added: MergeReport['added'];
      replaced: MergeReport['replaced'];
      skipped: MergeReport['skipped'];
      /** The card's state AFTER the patch — so a follow-up patch has a precise target. */
      tier: QualityTier;
      stillMissing: string[];
      v: number;
    }
  | {
      patched: false;
      reason: 'not-found' | 'no-card' | 'donor-unusable' | 'nothing-to-add' | 'conflict';
    };

/**
 * NON-DESTRUCTIVE update of one item's enrichment card: read, merge (lib/enrichment-merge.ts), write.
 *
 * It refuses rather than improvises when there is nothing to merge INTO (`no-card`): a patch has no
 * meaning on an absent or unparseable card, and inventing a whole card here would duplicate
 * `enrich_items` while hiding the overwrite. The caller is told which tool to use instead.
 *
 * Concurrency: the write is a compare-and-set on the exact card that was read, so a second session
 * patching the same item cannot silently clobber the first (`conflict` — retry after re-reading). Cheap
 * insurance for a read-modify-write that a plain `update` would lose.
 */
export async function patchEnrichment(
  input: PatchEnrichmentInput,
): Promise<PatchEnrichmentResult> {
  const item = await prisma.item.findFirst({
    where: { id: input.itemId },
    select: { id: true, expression: true, enrichment: true },
  });
  if (!item) return { patched: false, reason: 'not-found' };

  const base = parseEnrichment(item.enrichment);
  if (!base) return { patched: false, reason: 'no-card' };

  // `fromSharedItemId` (merge another member's card for the same pattern into yours) went out with
  // the public library — there is nobody to share from now, so a patch is only ever an explicit edit.
  const patch: EnrichmentPatch = { add: input.add, set: input.set };

  const report = mergeEnrichment(base, patch);
  if (!report.touched) return { patched: false, reason: 'nothing-to-add' };

  const json = JSON.stringify(report.card);
  const res = await prisma.item.updateMany({
    // `enrichment: item.enrichment` IS the compare-and-set — it matches only the row we merged from.
    where: { id: item.id, enrichment: item.enrichment },
    data: { enrichment: json, enrichedAt: new Date() },
  });
  if (res.count === 0) return { patched: false, reason: 'conflict' };

  const quality = scoreEnrichment(json);
  return {
    patched: true,
    expression: item.expression,
    added: report.added,
    replaced: report.replaced,
    skipped: report.skipped,
    tier: quality.tier,
    stillMissing: quality.missing,
    v: quality.v,
  };
}

/**
 * Practiced-sentence history (newest first), for the dashboard preview and the /history page.
 * INCLUDES PENDING rows (staged, not yet answered — the reference is already frozen, shown for
 * audit) and SKIPPED rows (viewed-not-answered → all Again); `status` lets the card render each.
 * Single-user app: fetch a generous cap and filter/paginate client-side rather than truncating.
 */
export async function listSentences(limit = 1000) {
  // Self-heal stale pendings on read so an open/reloaded history page never shows week-old "đang chờ".
  await autoSkipStalePending();
  const sentences = await prisma.sentence.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      reviews: {
        select: {
          rating: true,
          role: true,
          item: { select: { expression: true, level: true } },
        },
      },
    },
  });
  return sentences.map((s) => {
    // Sentence "difficulty" = the JLPT level of its TARGET pattern (the one the sentence is built
    // around); fall back to any rated pattern's level, else null (item may be null after a delete).
    const target =
      s.reviews.find((r) => r.role === 'TARGET' && r.item) ?? s.reviews.find((r) => r.item);
    return {
      id: s.id,
      direction: s.direction,
      status: s.status,
      // TRANSLATION | CLOZE | DIALOGUE | QUIZ — powers the "dạng bài" filter on /history.
      exerciseType: s.exerciseType,
      sourceText: s.sourceText,
      sourceRuby: s.sourceRuby,
      userAnswer: s.userAnswer,
      suggested: s.suggested,
      suggestedRuby: s.suggestedRuby,
      feedback: s.feedback,
      score: s.score,
      createdAt: s.createdAt,
      starred: s.starred,
      // History-card meta (2026-07-17): độ khó (level), chủ đề (context tag), thời gian làm bài
      // (answeredAt − createdAt), độ dài (source char count). answeredAt is null for PENDING/SKIPPED.
      level: target?.item?.level ?? null,
      context: s.context,
      answeredAt: s.answeredAt,
      charCount: s.sourceText.length,
      ratings: s.reviews.map((r) => ({
        expression: r.item?.expression ?? '(đã xóa)', // item may be null after a user-initiated delete
        rating: r.rating,
        role: r.role,
      })),
    };
  });
}

export type SentenceHistoryRow = Awaited<ReturnType<typeof listSentences>>[number];

export async function setItemSuspended(itemId: string, suspended: boolean) {
  await prisma.item.update({ where: { id: itemId }, data: { suspended } });
  return { itemId, suspended };
}

/** Bulk suspend/resume selected items (resources DataTable row-selection → "Tạm ngưng"). Reversible;
 *  never deletes. Returns how many rows changed. */
export async function setItemsSuspended(
  ids: string[],
  suspended: boolean,
): Promise<{ affected: number }> {
  if (ids.length === 0) return { affected: 0 };
  const res = await prisma.item.updateMany({
    where: { id: { in: ids } },
    data: { suspended },
  });
  return { affected: res.count };
}

/** Toggle a favourite star on an item (grammar or vocab). Pure UI flag — never touches FSRS. */
export async function setItemStarred(itemId: string, starred: boolean) {
  await prisma.item.update({ where: { id: itemId }, data: { starred } });
  return { itemId, starred };
}

/** Toggle a favourite star on a practiced sentence (history card). Pure UI flag. */
export async function setSentenceStarred(sentenceId: string, starred: boolean) {
  await prisma.sentence.update({ where: { id: sentenceId }, data: { starred } });
  return { sentenceId, starred };
}

export interface UpdateItemInput {
  expression?: string;
  reading?: string | null;
  hanviet?: string | null;
  meaningVi?: string;
  notes?: string | null;
  level?: string;
}

/**
 * Edit an item's CONTENT only (expression / reading / meaning / notes / level). NEVER touches
 * SrsState — the FSRS schedule (due/stability/difficulty/reps/lapses/state) is off-limits from the UI.
 * Throws P2002 on a (kind, expression) unique collision; the caller renders a friendly message.
 */
export async function updateItem(itemId: string, input: UpdateItemInput) {
  const data: Prisma.ItemUpdateInput = {};
  if (input.expression !== undefined) data.expression = cleanText(input.expression);
  if (input.reading !== undefined) data.reading = cleanTextOrNull(input.reading);
  if (input.hanviet !== undefined) data.hanviet = cleanTextOrNull(input.hanviet);
  if (input.meaningVi !== undefined) data.meaningVi = cleanText(input.meaningVi);
  if (input.notes !== undefined) data.notes = cleanTextOrNull(input.notes);
  if (input.level !== undefined) data.level = input.level;
  await prisma.item.update({ where: { id: itemId }, data });
  return { itemId };
}

/**
 * Delete an item + its FSRS state (SrsState cascades). ReviewLog is PRESERVED (schema onDelete:
 * SetNull) so the append-only history survives (invariant #2) — a deliberate, user-initiated delete.
 */
export async function deleteItem(itemId: string) {
  await prisma.item.delete({ where: { id: itemId } });
  return { itemId };
}

/**
 * Bulk-delete items by id (the resources DataTable's row-selection → "Xóa" action). Like `deleteItem`,
 * the ReviewLog is preserved: the schema's `onDelete: SetNull` NULLs each log's `itemId` instead of
 * cascading, so history survives (invariant #2). Returns how many rows were actually removed.
 */
export async function deleteItems(ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };
  const res = await prisma.item.deleteMany({ where: { id: { in: ids } } });
  return { deleted: res.count };
}

/**
 * Bulk hide/show every pattern EASIER than the study target (`settings.grammarLevels`), so the learner
 * reaches their level fast instead of grinding lower patterns they already know. Reversible
 * (suspended=false un-hides), never deletes. Level-agnostic: "below target" = JLPT number strictly
 * greater than the EASIEST studied level (N5=5 … N1=1) so a studied level is never hidden — derived
 * from settings, no level hardcoded. E.g. study [N3] hides N4+N5; study [N3,N4] hides only N5.
 */
export async function setBelowTargetSuspended(
  suspended: boolean,
): Promise<{ affected: number; levels: string[] }> {
  const settings = await getSettings();
  const num = (l: string) => Number(l.slice(1));
  const easiestStudied = Math.max(...settings.grammarLevels.map(num)); // [N3,N4] → 4 (N4 is easiest studied)
  const belowLevels = JLPT_LEVELS.filter((l) => num(l) > easiestStudied); // strictly easier → hide
  if (belowLevels.length === 0) return { affected: 0, levels: [] };
  const res = await prisma.item.updateMany({
    where: { level: { in: belowLevels }, suspended: !suspended },
    data: { suspended },
  });
  return { affected: res.count, levels: belowLevels };
}

export interface WeakReport {
  windowDays: number;
  /** Misses (rating ≤ 2) in the window, grouped by taxonomy tag, most common first. */
  tagCounts: { tag: ErrorTag; count: number }[];
  /** Items most often tagged in the window (what to drill). */
  worstItems: {
    itemId: string;
    expression: string;
    misses: number;
    tags: ErrorTag[];
  }[];
  /** Leeches: high-lapse items; suspendSuggested at Anki's default threshold. */
  leeches: {
    itemId: string;
    expression: string;
    meaningVi: string;
    lapses: number;
    suspendSuggested: boolean;
  }[];
}

export async function getWeakReport(
  now: Date = new Date(),
  windowDays = 30,
): Promise<WeakReport> {
  const since = new Date(now.getTime() - windowDays * 86400000);
  const [misses, leechRows] = await Promise.all([
    prisma.reviewLog.findMany({
      // item isNot null → skip logs whose item was deleted (kept for streak/activity, but they can't
      // be drilled since the pattern is gone). item.expression is therefore always present below.
      where: { reviewedAt: { gte: since }, rating: { lte: 2 }, item: { isNot: null } },
      select: {
        errorTags: true,
        itemId: true,
        item: { select: { expression: true } },
      },
    }),
    prisma.srsState.findMany({
      where: { lapses: { gte: LEECH_LAPSES }, item: { suspended: false } },
      include: { item: { select: { expression: true, meaningVi: true } } },
      orderBy: { lapses: 'desc' },
      take: 15,
    }),
  ]);

  const tagTally = new Map<ErrorTag, number>();
  const perItem = new Map<string, { expression: string; misses: number; tags: Set<ErrorTag> }>();
  for (const miss of misses) {
    if (miss.itemId == null) continue; // guarded by the `itemId not null` filter; narrows the type
    const entry = perItem.get(miss.itemId) ?? {
      expression: miss.item?.expression ?? '(đã xóa)',
      misses: 0,
      tags: new Set<ErrorTag>(),
    };
    entry.misses += 1;
    for (const tag of parseErrorTags(miss.errorTags)) {
      tagTally.set(tag, (tagTally.get(tag) ?? 0) + 1);
      entry.tags.add(tag);
    }
    perItem.set(miss.itemId, entry);
  }

  return {
    windowDays,
    tagCounts: [...tagTally.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
    worstItems: [...perItem.entries()]
      .map(([itemId, e]) => ({
        itemId,
        expression: e.expression,
        misses: e.misses,
        tags: [...e.tags],
      }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 10),
    leeches: leechRows.map((s) => ({
      itemId: s.itemId,
      expression: s.item.expression,
      meaningVi: s.item.meaningVi,
      lapses: s.lapses,
      suspendSuggested: s.lapses >= SUSPEND_SUGGEST_LAPSES,
    })),
  };
}
