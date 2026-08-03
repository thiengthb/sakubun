// Zod schema for practice settings — the single validation contract shared by the settings form,
// the Server Action and the MCP update_settings tool. Stored as a JSON blob in the Settings row.

import { z } from 'zod';

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export const DIRECTIONS = ['JA_VI', 'VI_JA', 'ALTERNATING'] as const;
// ONE "sentence size" knob (2026-07-11): each tier deterministically DERIVES both a per-language
// char target AND a grammar-pattern count (lib/select.ts SENTENCE_SIZE_SPEC). This re-merges the
// two old knobs (patternsPerSentence + sentenceLength) but WITHOUT the old "set 5, get 3" bug —
// there is one input and the derivation is fixed, so nothing can drift out of sync. Cramming 5
// patterns into a 10-char sentence was impossible → tie pattern count to length as a quality floor.
export const SENTENCE_SIZES = [
  'xshort',
  'short',
  'medium',
  'long',
  'xlong',
  'huge',
  'paragraph',
] as const;
export const TRANSLATION_STYLES = ['natural', 'balanced', 'accurate'] as const;
export const REGISTERS = ['casual', 'polite', 'keigo', 'business', 'written', 'mixed'] as const;
// Multi-sensory axes (2026-07-11). How the EXERCISE reaches the learner and how they must ANSWER —
// honored by Claude in its voice-mode session (the app cannot toggle the client's voice mode; it only
// plays reference TTS). `speech-only` challenges listening; `speak-only` forces spoken production.
export const PROMPT_MODALITIES = ['text', 'text+speech', 'speech-only'] as const;
export const ANSWER_MODALITIES = ['speak-or-write', 'speak-only'] as const;
// Where furigana (kana over kanji) is shown. Replaces the old boolean furiganaHint (2026-07-19): the
// app ALWAYS receives the reading data from Claude; this only decides WHO displays it. 'app' = only the
// app renders ruby (Claude keeps its chat clean); 'claude' = only Claude inlines readings in its
// output; 'both'; 'none'. Default 'app' (per the supervisor).
export const FURIGANA_MODES = ['app', 'claude', 'both', 'none'] as const;
export type FuriganaMode = (typeof FURIGANA_MODES)[number];
/** Should the APP render furigana ruby? (true for 'app'/'both'.) */
export const furiganaInApp = (m: FuriganaMode): boolean => m === 'app' || m === 'both';
/** Should CLAUDE inline furigana in its visible output? (true for 'claude'/'both'.) */
export const furiganaForClaude = (m: FuriganaMode): boolean => m === 'claude' || m === 'both';

/**
 * Curated VOICEVOX speaker voices for the app's reference TTS (the "Nghe" buttons in /history). Each
 * entry is a VOICEVOX `speaker` id (style) → a Vietnamese label naming the gender + tone, so the user
 * can pick a male/female/warm/deep voice. Passed as `?speaker=` to `/api/tts`; if a chosen id isn't
 * installed in the running engine the route 503s and the client falls back to Web Speech (never
 * silent). Ids are the stable standard VOICEVOX style ids. Keep this a small, confident subset.
 */
export const VOICE_SPEAKERS = [
  { id: 3, label: 'Nữ · dễ thương (ずんだもん)' },
  { id: 2, label: 'Nữ · trong trẻo (四国めたん)' },
  { id: 0, label: 'Nữ · ngọt ngào (四国めたん)' },
  { id: 36, label: 'Nữ · thì thầm nhẹ (四国めたん)' },
  { id: 8, label: 'Nữ · tươi trẻ (春日部つむぎ)' },
  { id: 16, label: 'Nữ · ấm (九州そら)' },
  { id: 14, label: 'Nữ · nhẹ nhàng (冥鳴ひまり)' },
  { id: 9, label: 'Nữ · trầm (波音リツ)' },
  { id: 11, label: 'Nam · trầm chuẩn (玄野武宏)' },
  { id: 13, label: 'Nam · trầm ấm (青山龍星)' },
  { id: 12, label: 'Nam · trẻ trung (白上虎太郎)' },
  { id: 21, label: 'Nam · mạnh (剣崎雌雄)' },
] as const;

/**
 * Preset content themes (one-click chips; free-text still allowed). Spread beginner→advanced so the
 * learner can widen vocabulary domains as they level up — everyday topics first, abstract/formal last.
 */
export const TOPIC_PRESETS = [
  'đời sống',
  'gia đình & bạn bè',
  'trường học',
  'công việc',
  'mua sắm',
  'ẩm thực',
  'du lịch',
  'sức khỏe',
  'công nghệ',
  'văn hóa & xã hội',
  'tin tức thời sự',
  'kinh tế',
  'khoa học',
  'môi trường',
  'truyện & đời thường',
  'nghị luận',
] as const;

/**
 * What each `difficulty` rung MEANS, in countable structural terms (2026-07-26).
 *
 * The problem it fixes: `difficulty` was an integer 1-5 consumed only as prose ("difficulty: 4/5"),
 * so it was the weakest field in the settings — two learners' "4" could differ, the grader had no
 * shared definition to grade against, and no code could ever check whether a generated sentence
 * matched the setting. Anchoring it to clause count / subordination depth / particle subtlety makes
 * it a real control: the same text is quoted into the composition sheet (Claude-facing, English) and
 * into the settings help text (learner-facing, Vietnamese), so the two can never drift.
 *
 * Deliberately about SHAPE only. Vocabulary hardness is `vocabCeiling`, novelty is
 * `maxNewPerSentence`, length is `sentenceSize` — this knob must not smuggle any of them back in.
 */
export const DIFFICULTY_ANCHORS: Record<number, { en: string; vi: string }> = {
  1: {
    en: 'ONE clause, no subordination. Core particles only (は・が・を・に・で). Plain SVO order.',
    vi: 'Một mệnh đề, không mệnh đề phụ. Chỉ trợ từ cơ bản (は・が・を・に・で). Trật tự thẳng.',
  },
  2: {
    en: 'TWO clauses joined by a simple connective (〜て・〜から・〜が). At most one modifier phrase.',
    vi: 'Hai mệnh đề nối bằng liên từ đơn giản (〜て・〜から・〜が). Nhiều nhất một cụm bổ nghĩa.',
  },
  3: {
    en: 'One clause EMBEDDED inside another (a relative clause, a 〜と／〜ように quote or comparison), or a nominalised clause (こと・の).',
    vi: 'Có một mệnh đề LỒNG trong mệnh đề khác (mệnh đề quan hệ, dẫn ý 〜と／〜ように), hoặc mệnh đề danh hoá (こと・の).',
  },
  4: {
    en: 'Subordination TWO levels deep, or a sentence whose meaning turns on a subtle particle/adverb contrast (は vs が for focus, も・こそ・さえ, どうも・さすが).',
    vi: 'Mệnh đề lồng HAI tầng, hoặc nghĩa của câu phụ thuộc vào sắc thái trợ từ/phó từ (は vs が, も・こそ・さえ, どうも・さすが).',
  },
  5: {
    en: 'Marked word order or inversion, an implied/omitted subject the reader must recover, and stacked modality (〜のではないかと思われる) — every element load-bearing.',
    vi: 'Đảo trật tự, chủ ngữ bị lược người đọc phải tự suy ra, và nhiều lớp thể thái xếp lên nhau (〜のではないかと思われる) — mọi thành phần đều mang nghĩa.',
  },
};

export type JlptLevel = (typeof JLPT_LEVELS)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type SentenceSize = (typeof SENTENCE_SIZES)[number];

export const settingsSchema = z.object({
  // Which JLPT levels a NEW grammar pattern may be introduced from — the SRS queue filter, nothing
  // else. Split out of the old `levels` field (2026-07-26): that one knob decided BOTH "what may
  // enter the queue" AND "what vocabulary Claude may reach for", forcing two independent pedagogical
  // choices to be equal. A learner drilling N3 grammar may well want N2 lexical exposure, or the
  // reverse. See vocabCeiling + migrateSettingsInput.
  grammarLevels: z.array(z.enum(JLPT_LEVELS)).min(1).default(['N5']),
  // Hardest level Claude may reach for as FREE vocabulary material (never a scheduled item).
  // null = follow grammarLevels automatically, which is what the single old field did — so the
  // learner maintains nothing unless they deliberately want the two to differ.
  vocabCeiling: z.enum(JLPT_LEVELS).nullable().default(null),
  // JA_VI = read Japanese → translate to Vietnamese; ALTERNATING flips every sentence (bilingual mode).
  direction: z.enum(DIRECTIONS).default('ALTERNATING'),
  // STRUCTURAL complexity, NOT vocab novelty (vocab hardness follows vocabCeiling). ANCHORED to
  // countable properties as of 2026-07-26 — before that it was an unanchored integer read only as
  // prose, so one learner's "4" and the grader's "4" could mean different things and nothing in code
  // could check it. Each rung is defined by clause count / subordination depth / particle subtlety;
  // the single source of those definitions is DIFFICULTY_ANCHORS below, quoted verbatim into the
  // composition sheet AND into the settings help text so generation and grading cannot drift apart.
  difficulty: z.number().int().min(1).max(5).default(2),
  // Sentence "size" — ONE knob that derives BOTH the source-sentence char target (per language) and
  // the grammar-pattern count woven into it (lib/select.ts SENTENCE_SIZE_SPEC). Bigger = longer +
  // more patterns; a short sentence can't honestly carry many patterns.
  sentenceSize: z.enum(SENTENCE_SIZES).default('medium'),
  // Grading emphasis: natural = idiomatic target text · accurate = fidelity to every element.
  translationStyle: z.enum(TRANSLATION_STYLES).default('natural'),
  // Japanese register the sentences are written/expected in.
  register: z.enum(REGISTERS).default('polite'),
  // Free-form topic hints for sentence content (e.g. "công việc", "anime").
  topics: z.array(z.string().trim().min(1)).max(20).default([]),
  // How many new grammar patterns to introduce per day.
  dailyNewGrammar: z.number().int().min(0).max(20).default(3),
  // How many NEVER-SEEN patterns one sentence may carry (2026-07-26). dailyNewGrammar is a DAY
  // budget and was silently doing this job too: with an empty review queue the picker filled every
  // grammar slot from the fresh pool, so the defaults put 3 brand-new patterns in ONE sentence on a
  // learner's first day (lab-verified) — each owing its own mini-lesson. Default 1 (one novel element
  // at a time); constrained-generation research also shows fluency degrades per added constraint, so
  // a sentence built around several unknown structures is unnatural as well as overwhelming.
  maxNewPerSentence: z.number().int().min(1).max(5).default(1),
  maxReviewsPerDay: z.number().int().min(10).max(500).default(100),
  // Vocabulary revived 2026-07-11 (demand-driven, in-context via add_vocab). How many due VOCAB words
  // to weave into EACH sentence, ALONGSIDE the grammar patterns — a SEPARATE budget that never eats
  // the grammar pattern count or the grammar review/new caps (the anti-N5-drag guarantee). 0 = off.
  vocabPerSentence: z.number().int().min(0).max(5).default(2),
  // Daily sentence goal — visible progress ("câu 5/10") is a habit anchor (Duolingo-style).
  sessionGoal: z.number().int().min(3).max(50).default(10),
  // FSRS request_retention — higher = shorter intervals, more reviews.
  desiredRetention: z.number().min(0.7).max(0.97).default(0.9),
  // Where furigana is shown (app renders ruby / Claude inlines readings / both / none). The app always
  // gets the reading data; this only routes the DISPLAY. See FURIGANA_MODES. Default 'app'.
  furiganaMode: z.enum(FURIGANA_MODES).default('app'),
  // Multi-sensory (nghe/nói). promptModality: how the exercise is delivered — text (default), text+speech
  // (Claude also reads it aloud in voice mode), or speech-only (spoken only, to train listening — text
  // hidden until answered). answerModality: whether the learner may write OR must speak. Claude honors
  // these in its voice-mode session; the app cannot switch the client's voice mode — it only plays TTS.
  promptModality: z.enum(PROMPT_MODALITIES).default('text'),
  answerModality: z.enum(ANSWER_MODALITIES).default('speak-or-write'),
  // Which VOICEVOX voice the app's reference-audio buttons use (see VOICE_SPEAKERS). App-only — this
  // drives the local TTS engine, NOT Claude's voice mode. Any integer is allowed (the engine has more
  // styles than the curated picker); an uninstalled id just falls back to Web Speech at play time.
  voiceSpeaker: z.number().int().min(0).default(3),
  // Default playback speed for the app's reference-audio buttons (VOICEVOX `speedScale` / Web Speech
  // `rate`). 1 = natural; <1 slower (easier to follow along), >1 faster. Per-play overridable inline on
  // the button (a slower listen for one sentence) without changing this default. App-only, not Claude's
  // voice mode.
  speechRate: z.number().min(0.5).max(2).default(1),
  // Reviews "belong to a day" until this hour (Anki-style 4 AM cutoff).
  dayCutoffHour: z.number().int().min(0).max(6).default(4),
  // Daily study reminder time, "HH:MM" (24h), or null = no reminder. SETTINGS-ONLY for now: it is
  // stored + exposed via MCP get_settings, but the app does NOT send email yet (no always-on
  // scheduler). Wiring real delivery is a separate future plan — and when it lands, the reminder goes
  // to the signed-in user's OWN account email (better-auth `user.email`), never a stored address. The
  // old per-settings `notificationEmail` field was removed 2026-07-22: in a multi-user app a hardcoded
  // default address is wrong, and the account email is the single source of truth for who to notify.
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ nhắc phải dạng HH:MM')
    .nullable()
    .default(null),
  // When on, every sentence the learner GRADES is auto-shared to the members' feed (visibility=shared),
  // so their new attempts reach the community without toggling each one. Opt-in (off by default);
  // toggled from the /history community tab, honored in submitReview. Existing rows are untouched.
  autoShareSentences: z.boolean().default(false),
  /**
   * Which of Claude's proposals it may carry out WITHOUT asking first. Every flag defaults to OFF —
   * the app's culture is "never add before I agree", and the caps on suggestions only mean anything if
   * a suggestion is a question.
   *
   * What "auto" actually does is narrower than it sounds, on purpose: `check_library` stays READ-ONLY
   * whatever these say. The flag marks the proposal `auto`, and Claude then calls the REAL tool itself
   * and reports what it did. A lookup that wrote as a side effect would put a mutation behind a tool
   * whose whole contract is that it does not mutate, and the audit trail would lose the call.
   *
   * Only ADDITIVE, reversible classes are offered here. There is deliberately no flag for anything that
   * overwrites (`enrich_items`) or changes the schedule.
   */
  autoCapture: z
    .object({
      /** Take a copy of a public item the learner clearly wanted. Reversible: delete it. */
      fork: z.boolean().default(false),
      /** Add a word the learner asked about / visibly misused. Reversible: delete it. */
      vocab: z.boolean().default(false),
      /** MERGE a missing contrast/pitfall into a card — never an overwrite (patch_enrichment only). */
      enrichPatch: z.boolean().default(false),
    })
    .default({ fork: false, vocab: false, enrichPatch: false }),
});

export const settingsPatchSchema = settingsSchema.partial();

export type Settings = z.infer<typeof settingsSchema>;
/**
 * A patch as it ARRIVES (z.input), not as it comes out of the parser. `saveSettings` re-validates
 * anyway, and with a nested defaulted object (`autoCapture`) the output type demands every inner key —
 * which would make "toggle one flag" untypeable for every caller.
 */
export type SettingsPatch = z.input<typeof settingsPatchSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/**
 * The settings COMPOSITION actually steers by — the projection embedded in every `get_due_items`
 * result (2026-07-26).
 *
 * Why a projection and not a deletion: the full settings object rides on the composition sheet, which
 * is re-sent on EVERY turn, so an irrelevant field is a per-TURN token tax rather than a one-off
 * per-session cost. Nothing is removed from the app — `get_settings` and the settings page keep the
 * whole object; only the per-turn payload is narrowed. It also makes "which settings actually steer
 * generation" an answerable question instead of a guess.
 *
 * Excluded, because no composition path reads them: `voiceSpeaker` / `speechRate` (the APP's own TTS
 * buttons, unrelated to Claude), `dayCutoffHour` (a server-side day boundary), `desiredRetention`
 * (FSRS maths, and invariant 1 keeps scheduling off Claude's hands), `autoShareSentences` (a feed
 * toggle), `reminderTime` (documented as not delivered yet — a dead field that was being shipped every
 * turn). The three PACE numbers are KEPT even though the plan listed `maxReviewsPerDay` as droppable:
 * the HELD BACK lines in `lib/mcp/render.ts` now name each cap and offer to raise it, so Claude needs
 * the current value to say something useful. A field with a reader stays.
 */
export const COMPOSITION_SETTING_KEYS = [
  'grammarLevels',
  'vocabCeiling',
  'direction',
  'difficulty',
  'sentenceSize',
  'translationStyle',
  'register',
  'topics',
  'dailyNewGrammar',
  'maxNewPerSentence',
  'maxReviewsPerDay',
  'vocabPerSentence',
  'sessionGoal',
  'furiganaMode',
  'promptModality',
  'answerModality',
] as const;

export type CompositionSettings = Pick<Settings, (typeof COMPOSITION_SETTING_KEYS)[number]>;

export function toCompositionSettings(settings: Settings): CompositionSettings {
  const out = {} as Record<string, unknown>;
  for (const key of COMPOSITION_SETTING_KEYS) out[key] = settings[key];
  return out as CompositionSettings;
}

/** Hardest JLPT level in a set (N1 hardest, N5 easiest). Empty set → N5. */
export function hardestLevel(levels: readonly string[]): JlptLevel {
  const sorted = [...levels].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return (sorted[0] as JlptLevel) ?? 'N5';
}

/**
 * The level Claude's free vocabulary may reach. `vocabCeiling: null` means "track the grammar
 * levels" — the single-knob behaviour from before the split, so an untouched account behaves
 * identically.
 */
export function resolveVocabCeiling(
  settings: Pick<Settings, 'vocabCeiling' | 'grammarLevels'>,
): JlptLevel {
  return settings.vocabCeiling ?? hardestLevel(settings.grammarLevels);
}

/**
 * Accept the PRE-split shape (2026-07-26). A stored blob — or an `update_settings` patch written from
 * habit — may still carry `levels`; map it onto `grammarLevels` BEFORE validating. Without this the
 * Zod default would quietly reset a learner studying N3 back to N5, which is silent data loss on
 * every existing account, not a cosmetic migration. `vocabCeiling` stays null so the derived ceiling
 * equals the old `hardestLevel(levels)`.
 */
export function migrateSettingsInput(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (!('levels' in o)) return o;
  if (o.grammarLevels === undefined && Array.isArray(o.levels)) o.grammarLevels = o.levels;
  delete o.levels;
  return o;
}

/** Parse a stored JSON blob leniently — unknown/invalid fields fall back to defaults. */
export function parseStoredSettings(raw: string | null | undefined): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed: unknown = migrateSettingsInput(JSON.parse(raw));
    const result = settingsSchema.safeParse(parsed);
    if (result.success) return result.data;
    // Salvage the valid fields, default the rest (schema evolution tolerance).
    const partial = settingsPatchSchema.safeParse(parsed);
    return { ...DEFAULT_SETTINGS, ...(partial.success ? partial.data : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
