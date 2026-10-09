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
import {
  CURRENT_ENRICHMENT_VERSION,
  parseEnrichment,
  toTutorCard,
  type Enrichment,
} from '@/lib/enrichment';
import {
  mergeEnrichment,
  type EnrichmentAdd,
  type EnrichmentPatch,
  type EnrichmentSet,
  type MergeReport,
} from '@/lib/enrichment-merge';
import {
  meetsCurrentBar,
  needsWork,
  scoreEnrichment,
  type QualityTier,
} from '@/lib/enrichment-quality';
import { asItemKind, GRAMMAR_KIND, VOCAB_KIND } from '@/lib/item-kinds';
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
  quizAnswerMismatch,
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

export async function getSettings(): Promise<Settings> {
  const row = await prisma.settings.findFirst({ orderBy: { id: 'asc' } });
  return parseStoredSettings(row?.data);
}

export async function saveSettings(patch: SettingsPatch): Promise<Settings> {
  const validated = settingsPatchSchema.parse(migrateSettingsInput(patch));
  const merged: Settings = { ...(await getSettings()), ...validated };
  const data = JSON.stringify(merged);
  const existing = await prisma.settings.findFirst({ orderBy: { id: 'asc' } });
  if (existing) await prisma.settings.update({ where: { id: existing.id }, data: { data } });
  else await prisma.settings.create({ data: { data } });
  return merged;
}

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

export { GRAMMAR_KIND, VOCAB_KIND };

export const TEACH_BACK_EXERCISE = 'TEACH_BACK';
export const QUIZ_EXERCISE = 'QUIZ';

export async function addItems(
  entries: ItemInput[],
  source = 'MCP',
  kind: string = GRAMMAR_KIND,
): Promise<AddItemsResult> {
  const result: AddItemsResult = { created: 0, skipped: [] };

  const seen = new Set<string>();
  const candidates: { expression: string; meaningVi: string; entry: ItemInput }[] = [];
  for (const entry of entries) {
    const cleaned = cleanText(entry.expression);
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
          srs: { create: { ...newSrsFields() } },
        },
      }),
    );
  }

  if (creates.length > 0) await prisma.$transaction(creates);
  result.created = creates.length;
  return result;
}

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

async function recentContextsFor(
  itemIds: string[],
  perItem = 3,
): Promise<Record<string, string[]>> {
  if (itemIds.length === 0) return {};
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
  sentences: number;
}

export async function todayCounts(
  settings: Settings,
  now: Date = new Date(),
): Promise<TodayCounts> {
  const dayStart = studyDayStart(now, settings.dayCutoffHour);
  const [reviews, newGrammar, sentences] = await Promise.all([
    prisma.reviewLog.count({
      where: { reviewedAt: { gte: dayStart }, item: { kind: GRAMMAR_KIND } },
    }),
    prisma.reviewLog.count({
      where: { reviewedAt: { gte: dayStart }, state: 0, item: { kind: GRAMMAR_KIND } },
    }),
    prisma.sentence.count({ where: { createdAt: { gte: dayStart }, status: 'GRADED' } }),
  ]);
  return { reviews, newGrammar, sentences };
}

export interface FocusInput {
  levels?: string[];
  patterns?: string[];
  weak?: boolean;
  groupId?: string;
}

export interface FocusMeta extends FocusInput {
  matched: number;
  unmatchedPatterns: string[];
  suspendedPatterns: { pattern: string; itemId: string; expression: string }[];
}

export interface WeakSpots {
  topTags: { tag: ErrorTag; count: number }[];
  byItem: Record<string, ErrorTag[]>;
}

export interface DueBatch extends PickedBatch {
  settings: CompositionSettings;
  today: TodayCounts;
  dueNow: number;
  newAvailable: { grammar: number };
  focus: FocusMeta | null;
  weakSpots: WeakSpots;
  newBeyondLevels: number;
  forExerciseType?: string;
  nextDueAt: Date | null;
  recentContexts: Record<string, string[]>;
}

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
  forExerciseType?: string,
): Promise<DueBatch> {
  const settings = await getSettings();
  const today = await todayCounts(settings, now);

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
    const suspendedPatterns = await suspendedFocusMatches(unmatched);
    const suspendedKeys = new Set(suspendedPatterns.map((s) => s.pattern));
    focusMeta = {
      ...focus,
      matched: rows.length,
      unmatchedPatterns: unmatched.filter((p) => !suspendedKeys.has(p)),
      suspendedPatterns,
    };
  }

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
      masteryPool = shuffle(gradRows).map((r) => toLite(r as SrsRow, false));
    }
  }

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
    settings: toCompositionSettings(settings),
    today,
    dueNow,
    newAvailable: { grammar: fresh.length },
    focus: focusMeta,
    weakSpots,
    newBeyondLevels,
    forExerciseType,
    nextDueAt: upcoming?.due ?? null,
    recentContexts,
  };
}

export interface RatingInput {
  itemId: string;
  rating: RatingValue;
  role?: ItemRole;
  errorTags?: string[];
  errorDetail?: Confusion[];
}

export interface StageSentenceInput {
  direction: 'JA_VI' | 'VI_JA';
  sourceText: string;
  suggested: string;
  context?: string;
  exerciseType?: string;
  sourceRuby?: string;
  suggestedRuby?: string;
  items?: { itemId: string; role: ItemRole }[];
  extraPatterns?: string[];
  quiz?: { correct: string; distractors: string[] };
}

export async function stageSentence(
  input: StageSentenceInput,
  now: Date = new Date(),
): Promise<{ sentenceId: string; quiz?: QuizOptions }> {
  const quiz = input.quiz
    ? buildQuizOptions(input.quiz.correct, input.quiz.distractors)
    : undefined;

  const withOptions = (text: string | null | undefined) =>
    quiz && text?.trim() ? `${text}\n\n${quiz.line}` : text;

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
  sentenceId: string;
  userAnswer: string;
  feedback?: string;
  score?: number;
  ratings: RatingInput[];
  learnerNote?: LearnerNoteInput;
  assists?: number;
}

export interface SubmitReviewResult {
  sentenceId: string;
  direction: 'JA_VI' | 'VI_JA';
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
  score: number | null;
  ratingNotes: string[];
  today: TodayCounts;
  dueNow: number;
  nextDueAt: Date | null;
  sessionGoal: number;
  calibration: CalibrationShadow | null;
  learnerNote: RecordNoteResult | null;
  teachBack: TeachBackHarvest | null;
}

export interface CalibrationShadow extends Proposal {
  ability: number;
  observations: number;
}

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

export async function listCalibrationProposals(
  limit = 50,
): Promise<StoredProposal[]> {
  return prisma.calibrationProposal.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

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

const ABILITY_ROW_ID = 'singleton';

const ABILITY_COLUMNS = {
  receptive: { rating: 'abilityReceptive', observations: 'receptiveObservations' },
  productive: { rating: 'abilityProductive', observations: 'productiveObservations' },
  register: { rating: 'abilityRegister', observations: 'registerObservations' },
} as const satisfies Record<AbilityAxis, { rating: string; observations: string }>;

async function getOrSeedAbility(settings: Settings) {
  const existing = await prisma.learnerAbility.findFirst();
  if (existing) return existing;
  const seed = initialAbility(settings);
  return prisma.learnerAbility.create({
    data: {
      id: ABILITY_ROW_ID,
      abilityReceptive: seed,
      abilityProductive: seed,
      abilityRegister: seed,
    },
  });
}

const CALIBRATION_LOG_WINDOW = 60;
const ENGAGEMENT_WINDOW_DAYS = 7;

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

  const chronological = [...logs].reverse();
  const onAxis = chronological.filter(
    (l) =>
      l.sentence
        ? axesFor(l.sentence.direction, l.sentence.exerciseType).includes(axis)
        : axis === 'receptive', // a legacy log with no sentence: treat as the default reading task
  );
  const estimate = successEstimate(onAxis.map((l) => RATING_OUTCOME[l.rating as RatingValue] ?? 0));

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
  if (sentence.status === 'GRADED') {
    throw new Error(
      `câu ${input.sentenceId} đã được chấm rồi — không gọi submit_review lần hai (rating chung thẩm)`,
    );
  }

  if (sentence.exerciseType === QUIZ_EXERCISE) {
    const clash = quizAnswerMismatch(sentence.sourceText, input.userAnswer);
    if (clash) {
      throw new Error(
        `Lượt quiz này ghi "chọn ${clash.named}" nhưng mẫu bạn nêu kèm lại là phương án ` +
          `${clash.shouldBe}; phương án ${clash.named} là 「${clash.patternAtNamed}」. Vị trí đáp án do ` +
          `SERVER xếp ở bước stage_sentence, nên hãy đọc lại đúng dòng phương án đã trả về. ` +
          `KHÔNG ghi gì cả: hãy gọi lại submit_review với cùng sentenceId, userAnswer đúng chữ cái người ` +
          `học đã chọn, và rating chấm theo phương án ở chữ cái ĐÓ.`,
      );
    }
  }

  const unique = new Map<string, RatingInput>();
  for (const r of input.ratings) if (!unique.has(r.itemId)) unique.set(r.itemId, r);
  const ratings = [...unique.values()];
  if (ratings.length === 0) throw new Error('ratings trống — cần ít nhất 1 item');

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

  const ability = await getOrSeedAbility(settings);
  const axes = axesFor(sentence.direction, sentence.exerciseType);
  const primaryAxis = axes[0];
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
      where: { id: ability.id },
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

  const [today, dueNow, nextDueAt, calibration, learnerNote] = await Promise.all([
    todayCounts(settings, now),
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
    computeCalibrationShadow(
      primaryAxis,
      running[primaryAxis].rating,
      running[primaryAxis].observations,
      settings,
      now,
    ).catch(() => null),
    input.learnerNote
      ? recordLearnerNote(input.learnerNote, now).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (calibration) {
    await recordCalibrationProposal(calibration, input.sentenceId, now).catch(() => null);
  }

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
    nextDueAt: nextDueAt?.due ?? null,
    sessionGoal: settings.sessionGoal,
    calibration,
    learnerNote,
    teachBack,
    ratingNotes,
  };
}

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

const PENDING_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

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

const STREAK_TTL_MS = 60_000;
let streakCache: { value: Streak; dayKey: string; at: number } | null = null;

export function invalidateStreak(): void {
  streakCache = null;
}

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

  const byState = new Map(stateRows.map((r) => [r.state, r._count]));
  const mastery = {
    new: byState.get(0) ?? 0,
    learning: byState.get(1) ?? 0,
    review: byState.get(2) ?? 0,
    relearning: byState.get(3) ?? 0,
    suspended,
  };

  const streak = await studyStreak(settings.dayCutoffHour, now);

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
  enriched?: boolean;
  quality?: QualityTier | 'needs-work';
  kind?: string;
  groupId?: string;
  withGroupIds?: boolean;
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
      ...(filter.withGroupIds ? { groups: { select: { groupId: true } } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filter.quality ? QUALITY_SCAN_CAP : (filter.limit ?? 50),
  });
  const scoped = filter.quality
    ? items
        .filter((i) => {
          const tier = scoreEnrichment(i.enrichment, i.kind).tier;
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
    card: (({ tier, missing, v }) => ({ tier, missing, v }))(
      scoreEnrichment(i.enrichment, i.kind),
    ),
    enrichedAt: i.enrichedAt,
    createdAt: i.createdAt,
    ...(filter.withGroupIds ? { groupIds: i.groups.map((g) => g.groupId) } : {}),
    srs: i.srs,
  }));
}

export async function getStreak(): Promise<{ current: number; longest: number }> {
  const settings = await getSettings();
  return studyStreak(settings.dayCutoffHour, new Date());
}

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
  contrastCandidates: string[];
  sameLevelCandidates: string[];
  newCapReached: boolean;
}

async function distractorCandidatesFor(
  kind: string,
  target: { id: string; expression: string; level: string; enrichment: Enrichment | null },
): Promise<{ contrastCandidates: string[]; sameLevelCandidates: string[] }> {
  const own = (target.enrichment?.contrasts ?? []).map((c) => c.with);

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
  const newBudget =
    kind === GRAMMAR_KIND
      ? Math.max(0, settings.dailyNewGrammar - (await todayCounts(settings, now)).newGrammar)
      : n;
  const newCapReached = kind === GRAMMAR_KIND && newBudget === 0;
  if (picked.length < n && newBudget > 0) {
    const newItems = await prisma.item.findMany({
      where: {
        kind,
        suspended: false,
        srs: { state: 0 },
        ...(kind === GRAMMAR_KIND ? { level: { in: settings.grammarLevels } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(n - picked.length, newBudget),
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
    newCapReached,
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

function stampVersion(enrichmentJson: string, kind: string): string {
  const card = parseEnrichment(enrichmentJson);
  if (!card) return enrichmentJson; // unparseable is the caller's problem to see, not ours to rewrite
  if (card.v >= CURRENT_ENRICHMENT_VERSION) return enrichmentJson;
  if (!meetsCurrentBar(card, asItemKind(kind))) return enrichmentJson;
  return JSON.stringify({ ...card, v: CURRENT_ENRICHMENT_VERSION });
}

export async function saveEnrichments(
  inputs: { itemId: string; enrichmentJson: string }[],
): Promise<{ updated: number; missing: string[] }> {
  const now = new Date();
  const existing = new Map(
    (
      await prisma.item.findMany({
        where: { id: { in: inputs.map((i) => i.itemId) } },
        select: { id: true, kind: true },
      })
    ).map((r) => [r.id, r.kind]),
  );
  const missing: string[] = [];
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const { itemId, enrichmentJson } of inputs) {
    const kind = existing.get(itemId);
    if (kind === undefined) {
      missing.push(itemId);
      continue;
    }
    updates.push(
      prisma.item.update({
        where: { id: itemId },
        data: { enrichment: stampVersion(enrichmentJson, kind), enrichedAt: now },
      }),
    );
  }
  if (updates.length > 0) await prisma.$transaction(updates);
  return { updated: updates.length, missing };
}

const QUALITY_SCAN_CAP = 500;

export const CONFUSION_WINDOW_DAYS = 90;

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
}

export type PatchEnrichmentResult =
  | {
      patched: true;
      expression: string;
      added: MergeReport['added'];
      replaced: MergeReport['replaced'];
      skipped: MergeReport['skipped'];
      tier: QualityTier;
      stillMissing: string[];
      v: number;
    }
  | {
      patched: false;
      reason: 'not-found' | 'no-card' | 'nothing-to-add' | 'conflict';
    };

export async function patchEnrichment(
  input: PatchEnrichmentInput,
): Promise<PatchEnrichmentResult> {
  const item = await prisma.item.findFirst({
    where: { id: input.itemId },
    select: { id: true, kind: true, expression: true, enrichment: true },
  });
  if (!item) return { patched: false, reason: 'not-found' };

  const base = parseEnrichment(item.enrichment);
  if (!base) return { patched: false, reason: 'no-card' };

  const patch: EnrichmentPatch = { add: input.add, set: input.set };

  const report = mergeEnrichment(base, patch, asItemKind(item.kind));
  if (!report.touched) return { patched: false, reason: 'nothing-to-add' };

  const json = JSON.stringify(report.card);
  const res = await prisma.item.updateMany({
    where: { id: item.id, enrichment: item.enrichment },
    data: { enrichment: json, enrichedAt: new Date() },
  });
  if (res.count === 0) return { patched: false, reason: 'conflict' };

  const quality = scoreEnrichment(json, item.kind);
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

export async function listSentences(limit = 1000, status?: 'PENDING' | 'GRADED' | 'SKIPPED') {
  await autoSkipStalePending();
  const sentences = await prisma.sentence.findMany({
    where: status ? { status } : undefined,
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
    const target =
      s.reviews.find((r) => r.role === 'TARGET' && r.item) ?? s.reviews.find((r) => r.item);
    return {
      id: s.id,
      direction: s.direction,
      status: s.status,
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

export async function setItemStarred(itemId: string, starred: boolean) {
  await prisma.item.update({ where: { id: itemId }, data: { starred } });
  return { itemId, starred };
}

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

export async function deleteItem(itemId: string) {
  await prisma.item.delete({ where: { id: itemId } });
  return { itemId };
}

export async function deleteItems(ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };
  const res = await prisma.item.deleteMany({ where: { id: { in: ids } } });
  return { deleted: res.count };
}

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
  tagCounts: { tag: ErrorTag; count: number }[];
  worstItems: {
    itemId: string;
    expression: string;
    misses: number;
    tags: ErrorTag[];
  }[];
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
