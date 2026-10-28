import { z } from 'zod';

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export const DIRECTIONS = ['JA_VI', 'VI_JA', 'ALTERNATING'] as const;
// How the new core picks a translation direction (lib/domain/compose.ts): auto follows the item.
export const DIRECTION_MODES = ['auto', 'JA_VI', 'VI_JA'] as const;
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
export const PROMPT_MODALITIES = ['text', 'text+speech', 'speech-only'] as const;
export const ANSWER_MODALITIES = ['speak-or-write', 'speak-only'] as const;
export const FURIGANA_MODES = ['app', 'claude', 'both', 'none'] as const;
export type FuriganaMode = (typeof FURIGANA_MODES)[number];
export const furiganaInApp = (m: FuriganaMode): boolean => m === 'app' || m === 'both';
export const furiganaForClaude = (m: FuriganaMode): boolean => m === 'claude' || m === 'both';
// The sidebar's あ switches the app's furigana and leaves Claude's as it was.
export const withAppFurigana = (m: FuriganaMode, on: boolean): FuriganaMode =>
  furiganaForClaude(m) ? (on ? 'both' : 'claude') : on ? 'app' : 'none';

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
export type DirectionMode = (typeof DIRECTION_MODES)[number];
export type SentenceSize = (typeof SENTENCE_SIZES)[number];

export const settingsSchema = z.object({
  grammarLevels: z.array(z.enum(JLPT_LEVELS)).min(1).default(['N5']),
  vocabCeiling: z.enum(JLPT_LEVELS).nullable().default(null),
  direction: z.enum(DIRECTIONS).default('ALTERNATING'),
  directionMode: z.enum(DIRECTION_MODES).default('auto'),
  difficulty: z.number().int().min(1).max(5).default(2),
  sentenceSize: z.enum(SENTENCE_SIZES).default('medium'),
  translationStyle: z.enum(TRANSLATION_STYLES).default('natural'),
  register: z.enum(REGISTERS).default('polite'),
  topics: z.array(z.string().trim().min(1)).max(20).default([]),
  dailyNewGrammar: z.number().int().min(0).max(20).default(3),
  dailyNewVocab: z.number().int().min(0).max(50).default(15),
  maxNewPerSentence: z.number().int().min(1).max(5).default(1),
  maxReviewsPerDay: z.number().int().min(10).max(500).default(100),
  vocabPerSentence: z.number().int().min(0).max(5).default(2),
  sessionGoal: z.number().int().min(3).max(50).default(10),
  desiredRetention: z.number().min(0.7).max(0.97).default(0.9),
  furiganaMode: z.enum(FURIGANA_MODES).default('app'),
  promptModality: z.enum(PROMPT_MODALITIES).default('text'),
  answerModality: z.enum(ANSWER_MODALITIES).default('speak-or-write'),
  voiceSpeaker: z.number().int().min(0).default(3),
  speechRate: z.number().min(0.5).max(2).default(1),
  dayCutoffHour: z.number().int().min(0).max(6).default(4),
  autoCapture: z
    .object({
      vocab: z.boolean().default(false),
      enrichPatch: z.boolean().default(false),
    })
    .default({ vocab: false, enrichPatch: false }),
});

export const settingsPatchSchema = settingsSchema.partial();

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsPatch = z.input<typeof settingsPatchSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

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
  out.direction = legacyDirection(settings);
  return out as CompositionSettings;
}

export function hardestLevel(levels: readonly string[]): JlptLevel {
  const sorted = [...levels].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return (sorted[0] as JlptLevel) ?? 'N5';
}

export function resolveVocabCeiling(
  settings: Pick<Settings, 'vocabCeiling' | 'grammarLevels'>,
): JlptLevel {
  return settings.vocabCeiling ?? hardestLevel(settings.grammarLevels);
}

// The web edits `directionMode`; the old MCP path still reads a Direction. Until roadmap 3.2 removes
// that path, this is the one bridge between them: auto alternates there, a fixed mode stays fixed.
export function legacyDirection(settings: Pick<Settings, 'directionMode'>): Direction {
  return settings.directionMode === 'auto' ? 'ALTERNATING' : settings.directionMode;
}

export function migrateSettingsInput(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if ('levels' in o) {
    if (o.grammarLevels === undefined && Array.isArray(o.levels)) o.grammarLevels = o.levels;
    delete o.levels;
  }
  // Settings stored before directionMode existed, and an MCP client still sending `direction`.
  if (o.directionMode === undefined && typeof o.direction === 'string') {
    o.directionMode = o.direction === 'ALTERNATING' ? 'auto' : o.direction;
  }
  return o;
}

// `direction` is kept equal to what directionMode means, so get_settings and anything else reading
// the old key never reports a direction the web has since changed.
export function syncDirection(settings: Settings): Settings {
  return { ...settings, direction: legacyDirection(settings) };
}

export function parseStoredSettings(raw: string | null | undefined): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed: unknown = migrateSettingsInput(JSON.parse(raw));
    const result = settingsSchema.safeParse(parsed);
    if (result.success) return syncDirection(result.data);
    const partial = settingsPatchSchema.safeParse(parsed);
    return syncDirection({ ...DEFAULT_SETTINGS, ...(partial.success ? partial.data : {}) });
  } catch {
    return DEFAULT_SETTINGS;
  }
}
