import type { QualityReport } from '@/lib/enrichment-quality';
import type { MinedPair } from '@/lib/mining';
import { sameExpression } from '@/lib/normalize';
import type { Settings } from '@/lib/settings-schema';
import { LEECH_LAPSES } from '@/lib/srs';

const MAX_DAILY_NEW_GRAMMAR = 20;

export type SuggestionCode =
  | 'ADD_MISSING' // 1  not in my library
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
  | 'RAISE_NEW_CAP' // 16 a pattern the learner asked for was withheld by the daily new cap
  | 'MINED_CONTRAST' // the learner's OWN repeated mistake names a contrast the card is missing
  | 'SWEEP_ENRICH' // 17 too many cards at a studied level still need work
  | 'SWEEP_MIGRATE' // 18 a pile of cards is stuck on an older format
  | 'TUNE_RETENTION' // 19 measured retention is off target in either direction
  | 'SUGGEST_GROUP' // 20 one error tag clusters over enough items to drill together
  | 'FASTTRACK'; // 21 a wall of below-target patterns is still in the queue

export type SuggestionClass = 'blocker' | 'enable' | 'quality' | 'sweep';

const CLASS_RANK: Record<SuggestionClass, number> = {
  blocker: 3,
  enable: 2,
  quality: 1,
  sweep: 0,
};

export interface Suggestion {
  code: SuggestionCode;
  priority: number;
  class: SuggestionClass;
  line: string;
  tool: string;
  alsoTool?: string;
  args: Record<string, unknown>;
  auto?: boolean;
}

export const MAX_SUGGESTIONS = 2;
export const MAX_SUGGESTIONS_MID_SESSION = 1;
const MAX_PER_CLASS = 1;

export interface ItemFacts {
  itemId: string;
  kind: 'GRAMMAR' | 'VOCAB';
  expression: string;
  level: string;
  suspended: boolean;
  hasKanji: boolean;
  hanviet: string | null;
  quality: QualityReport;
  contrastTargets: string[];
  srs: { state: number; due: Date; lapses: number } | null;
}

export interface CoachInput {
  query: string;
  mine: ItemFacts[];
  settings: Pick<Settings, 'grammarLevels'> &
    Partial<Pick<Settings, 'autoCapture' | 'dailyNewGrammar'>>;
  now: Date;
  midSession?: boolean;
  kind?: 'GRAMMAR' | 'VOCAB';
  withheldByNewCap?: readonly string[];
  minedPairs?: readonly MinedPair[];
}

export interface CoachResult {
  suggestions: Suggestion[];
  remaining: number;
}

function levelInRange(level: string, settings: CoachInput['settings']): boolean {
  return (settings.grammarLevels as readonly string[]).includes(level);
}

function forItem(item: ItemFacts, input: CoachInput): Suggestion[] {
  const out: Suggestion[] = [];
  const label = item.expression;
  const state = item.srs?.state ?? 0;
  const neverStudied = state === 0;

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
      line:
        `「${label}」 ở cấp ${item.level}, ngoài phạm vi đang học (${input.settings.grammarLevels.join(', ')}), ` +
        `nên chưa thể đưa vào — mở rộng sang ${item.level} chứ?`,
      tool: 'update_settings',
      args: { grammarLevels: [...input.settings.grammarLevels, item.level] },
    });
  }

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

  const mined = (input.minedPairs ?? []).find(
    (p) =>
      sameExpression(p.required, item.expression) &&
      !item.contrastTargets.some((t) => sameExpression(t, p.used)),
  );
  const minedHint = mined
    ? ` Nhớ thêm mục phân biệt với 「${mined.used}」 — bạn đã nhầm ${mined.count} lần.`
    : '';

  const q = item.quality;
  if (q.tier === 'missing') {
    out.push({
      code: 'ENRICH_MISSING',
      class: 'quality',
      priority: 45,
      line: `「${label}」 chưa có thẻ chi tiết — soạn thẻ (cách dùng, ví dụ, bẫy, phân biệt) chứ?${minedHint}`,
      tool: 'enrich_items',
      args: { items: [{ itemId: item.itemId }] },
    });
  } else if (q.tier === 'broken') {
    out.push({
      code: 'ENRICH_BROKEN',
      class: 'quality',
      priority: 46,
      line: `Thẻ của 「${label}」 bị lỗi định dạng nên hiện không dùng được gì — soạn lại chứ?${minedHint}`,
      tool: 'enrich_items',
      args: { items: [{ itemId: item.itemId }] },
    });
  } else if (q.tier === 'thin') {
    out.push({
      code: 'ENRICH_THIN',
      class: 'quality',
      priority: 40,
      line: `Thẻ của 「${label}」 còn thiếu: ${q.missing.join(', ')} — bổ sung chứ?`,
      tool: 'patch_enrichment',
      args: { itemId: item.itemId },
    });
  } else if (q.tier === 'outdated') {
    out.push({
      code: 'ENRICH_OUTDATED',
      class: 'quality',
      priority: 35,
      line: `Thẻ của 「${label}」 theo format cũ (v${q.v}) — cập nhật sang format mới chứ?`,
      tool: 'enrich_items',
      args: { items: [{ itemId: item.itemId }] },
    });
  }

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

export function coach(input: CoachInput): CoachResult {
  const all: Suggestion[] = [];

  if (input.mine.length === 0) {
    const addTool =
      input.kind === 'GRAMMAR' ? 'add_grammar' : input.kind === 'VOCAB' ? 'add_vocab' : null;
    all.push({
      code: 'ADD_MISSING',
      class: 'enable',
      priority: 74,
      line: `「${input.query}」 chưa có trong kho của bạn — thêm vào để học chứ?`,
      tool: addTool ?? 'add_vocab',
      alsoTool: addTool ? undefined : 'add_grammar',
      args:
        addTool === 'add_grammar'
          ? { grammar: [{ expression: input.query }] }
          : { vocab: [{ term: input.query }] },
    });
  }

  for (const item of input.mine) all.push(...forItem(item, input));

  for (const expression of input.withheldByNewCap ?? []) {
    all.push({
      code: 'RAISE_NEW_CAP',
      class: 'blocker',
      priority: 85,
      line: `「${expression}」 bị hoãn vì hết hạn mức mẫu mới hôm nay — nâng hạn mức lên chứ?`,
      tool: 'update_settings',
      args: {
        dailyNewGrammar: Math.min(
          MAX_DAILY_NEW_GRAMMAR,
          (input.settings.dailyNewGrammar ?? 3) + 1,
        ),
      },
    });
  }

  const auto = input.settings.autoCapture;
  if (auto) {
    for (const s of all) {
      if (auto.enrichPatch && s.tool === 'patch_enrichment') s.auto = true;
    }
  }

  return rankAndCap(all, input.midSession ? MAX_SUGGESTIONS_MID_SESSION : MAX_SUGGESTIONS);
}

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

export const SWEEP_MIN_NEEDS_WORK = 5;
export const SWEEP_MIN_OUTDATED = 10;
export const FASTTRACK_MIN_BELOW_TARGET = 20;
export const CLUSTER_MIN_MISSES = 5;
export const CLUSTER_MIN_ITEMS = 3;
export const RETENTION_STEP = 0.05;

export interface LibraryHealthFacts {
  needsWorkAtStudiedLevels: number;
  outdatedCards: number;
  belowTargetActive: number;
  retention: { kind: 'insufficient' | 'below' | 'on-target' | 'above'; gapPts: number | null };
  desiredRetention: number;
  weakCluster: { tag: string; label: string; misses: number; itemIds: string[] } | null;
}

export function coachLibrary(health: LibraryHealthFacts): CoachResult {
  const all: Suggestion[] = [];

  if (health.needsWorkAtStudiedLevels >= SWEEP_MIN_NEEDS_WORK) {
    all.push({
      code: 'SWEEP_ENRICH',
      class: 'sweep',
      priority: 30,
      line: `${health.needsWorkAtStudiedLevels} mẫu ở cấp bạn đang học có thẻ chưa đạt — soạn bù một loạt chứ?`,
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

export const TEACH_BACK_MIN_RATING = 3;
export const TEACH_BACK_MIN_CHARS = 40;
export const TEACH_BACK_MAX_CHARS = 600;

export interface TeachBackFacts {
  itemId: string;
  expression: string;
  rating: number;
  explanation: string;
  hasCard: boolean;
}

export interface TeachBackHarvest {
  itemId: string;
  expression: string;
  usage: string;
  rating: number;
}

export function coachTeachBack(facts: TeachBackFacts): TeachBackHarvest | null {
  if (facts.hasCard) return null;
  if (facts.rating < TEACH_BACK_MIN_RATING) return null;
  const usage = facts.explanation.trim().replace(/\s+/g, ' ');
  if (usage.length < TEACH_BACK_MIN_CHARS || usage.length > TEACH_BACK_MAX_CHARS) return null;
  return { itemId: facts.itemId, expression: facts.expression, usage, rating: facts.rating };
}
