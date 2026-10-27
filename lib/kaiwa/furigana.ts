import { hasFurigana } from '@/lib/japanese/furigana';
import { plainJapanese, type ScriptLine } from '@/lib/kaiwa/parse';

// Automatic furigana for Kaiwa scripts (phase 8, K4), worked out once when a script is saved. The
// tokenizer (lib/kaiwa/tokenizer.ts) gives each word its reading; this file turns those readings into
// the `漢字[よみ]` markup the rest of the app reads. Pure: the tokenizer is passed in.

export interface KaiwaToken {
  surface: string;
  // Hiragana, only for words written with kanji.
  reading?: string;
  // Dictionary form, when it differs from the surface (会い -> 会う), for the word lookup (K5).
  base?: string;
  pos?: string;
}

export interface LineAnalysis {
  // The line's Japanese with readings: the author's own `[..]` when they wrote any, else ours.
  ruby: string;
  tokens: KaiwaToken[];
}

export interface ScriptAnalysis {
  v: 1;
  lines: LineAnalysis[];
}

export type Tokenize = (text: string) => KaiwaToken[];

const KANJI = /[\p{Script=Han}々〆ヶ]/u;
const KANA_RUN = /[\p{Script=Hiragana}\p{Script=Katakana}ー]+/gu;

export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Splits a word's reading over its kanji, keeping the kana it is written with outside the brackets:
// 取り消し + とりけし -> 取[と]り消[け]し. When the kana do not line up, the whole word takes the
// reading.
export function wordRuby(surface: string, reading: string): string {
  if (!KANJI.test(surface)) return surface;
  const parts: { text: string; kana: boolean }[] = [];
  let at = 0;
  for (const m of surface.matchAll(KANA_RUN)) {
    if (m.index > at) parts.push({ text: surface.slice(at, m.index), kana: false });
    parts.push({ text: m[0], kana: true });
    at = m.index + m[0].length;
  }
  if (at < surface.length) parts.push({ text: surface.slice(at), kana: false });

  const pattern = parts.map((p) => (p.kana ? escape(toHiragana(p.text)) : '(.+?)')).join('');
  const match = new RegExp(`^${pattern}$`, 'u').exec(toHiragana(reading));
  if (!match) return `${surface}[${reading}]`;
  let group = 1;
  return parts.map((p) => (p.kana ? p.text : `${p.text}[${match[group++]}]`)).join('');
}

export function rubyFromTokens(tokens: readonly KaiwaToken[]): string {
  // A kanji word without a reading gets empty brackets, so the next word's reading does not
  // stretch back over it (parseFurigana reads `東京[]` as plain 東京).
  return tokens
    .map((t) =>
      KANJI.test(t.surface)
        ? t.reading
          ? wordRuby(t.surface, t.reading)
          : `${t.surface}[]`
        : t.surface,
    )
    .join('');
}

export function analyzeLines(lines: readonly ScriptLine[], tokenize: Tokenize): ScriptAnalysis {
  return {
    v: 1,
    lines: lines.map((line) => {
      const tokens = tokenize(plainJapanese(line.japanese));
      return {
        ruby: hasFurigana(line.japanese) ? line.japanese : rubyFromTokens(tokens),
        tokens,
      };
    }),
  };
}

// The stored analysis, if it is one this version wrote for these lines; anything else is ignored
// and the page falls back to the author's own furigana.
export function readAnalysis(json: string | null, lineCount: number): ScriptAnalysis | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as ScriptAnalysis;
    return parsed?.v === 1 && parsed.lines?.length === lineCount ? parsed : null;
  } catch {
    return null;
  }
}
