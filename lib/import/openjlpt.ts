// Phase 3.4: turn OpenJLPT (data/openjlpt/source.json) + Vietnamese meanings (vi.json) + per-kanji
// Hán Việt (hanviet-kanji.json) into an ACCOUNT BACKUP file that Settings → Nhập dữ liệu already
// understands. That importer previews first (dry run), never overwrites an item the learner has
// (same kind + expression is skipped) and keeps `source`/`tags`, so no new write path is needed.
// No "@/" imports: scripts/openjlpt/build-import.ts runs this file directly with Node.
import { createHash } from 'node:crypto';

export interface OjExample {
  ja: string;
  furigana: string | null;
  en: string | null;
}
export interface OjEntry {
  id: string;
  expression: string;
  level: string;
  meaningEn: string;
  reading?: string | null;
  formation?: string | null;
  pos?: string[];
  example?: OjExample | null;
}
export interface OjSource {
  version: string;
  commit: string;
  grammar: OjEntry[];
  vocab: OjEntry[];
}
export type ViMap = Record<string, { meaningVi: string; hanviet?: string | null }>;
// `source` from scripts/openjlpt/hanviet.mjs; only 'agree' (Unihan or the Hán Việt dictionary lists the
// model's reading) is used — the learner chose blanks over readings that are wrong about 1 time in 10.
export type HanvietTable = Record<string, { reading: string | null; source?: string }>;

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const KANJI = /[一-鿿]/;

// A word's Hán Việt spelled from its kanji; null when any kanji has no reading (half a reading misleads).
export function spellHanviet(expression: string, table: HanvietTable): string | null {
  // 々 repeats the kanji before it (清々しい → THANH THANH).
  const chars = [...expression].map((c, i, a) => (c === '々' && i > 0 ? a[i - 1] : c));
  const ks = chars.filter((c) => KANJI.test(c));
  if (ks.length === 0) return null;
  const parts = ks.map((c) => (table[c]?.source === 'agree' ? table[c].reading : null));
  return parts.every(Boolean) ? parts.join(' ').toUpperCase() : null;
}

function itemId(kind: string, expression: string): string {
  return `openjlpt-${kind.toLowerCase()}-${createHash('sha1').update(expression).digest('hex').slice(0, 12)}`;
}

function notesFor(e: OjEntry): string {
  const parts: string[] = [];
  if (e.formation) parts.push(`Cách nối: ${e.formation}`);
  parts.push(`EN: ${e.meaningEn}`);
  if (e.example) parts.push(`Ví dụ: ${e.example.ja}${e.example.en ? ` (${e.example.en})` : ''}`);
  return parts.join(' · ');
}

// Reads back the example notesFor wrote, for items whose only sentence lives in their notes.
export function exampleFromNotes(
  notes: string | null | undefined,
): { ja: string; en: string | null } | null {
  const at = notes?.lastIndexOf('Ví dụ: ') ?? -1;
  if (!notes || at < 0) return null;
  const rest = notes.slice(at + 'Ví dụ: '.length).trim();
  const open = rest.indexOf(' (');
  const ja = (open < 0 ? rest : rest.slice(0, open)).trim();
  const en = open < 0 || !rest.endsWith(')') ? null : rest.slice(open + 2, -1).trim() || null;
  return ja ? { ja, en } : null;
}

export interface BuildResult {
  items: {
    id: string;
    kind: string;
    expression: string;
    reading: string | null;
    hanviet: string | null;
    meaningVi: string;
    level: string;
    notes: string;
    tags: string;
    source: 'OPENJLPT';
    suspended: false;
    starred: false;
  }[];
  srsStates: {
    id: string;
    itemId: string;
    due: string;
    stability: 0;
    difficulty: 0;
    scheduledDays: 0;
    learningSteps: 0;
    reps: 0;
    lapses: 0;
    state: 0;
    lastReview: null;
  }[];
  skipped: { id: string; expression: string; reason: string }[];
  merged: number;
}

export function buildImport(src: OjSource, vi: ViMap, hv: HanvietTable, now: Date): BuildResult {
  const out: BuildResult = { items: [], srsStates: [], skipped: [], merged: 0 };
  const byKey = new Map<string, BuildResult['items'][number]>();
  const rows: [string, OjEntry][] = [
    ...src.grammar.map((e): [string, OjEntry] => ['GRAMMAR', e]),
    ...src.vocab.map((e): [string, OjEntry] => ['VOCAB', e]),
  ];
  for (const [kind, e] of rows) {
    const meaningVi = vi[e.id]?.meaningVi?.trim();
    if (!meaningVi) {
      out.skipped.push({ id: e.id, expression: e.expression, reason: 'chưa có nghĩa tiếng Việt' });
      continue;
    }
    const key = `${kind}\u0000${e.expression}`;
    const prev = byKey.get(key);
    if (prev) {
      // Same word listed at two levels (116 in v0.3.0): keep the EASIER level, add the other meaning.
      out.merged++;
      if (LEVELS.indexOf(e.level) < LEVELS.indexOf(prev.level)) prev.level = e.level;
      if (!prev.meaningVi.split('; ').includes(meaningVi))
        prev.meaningVi = `${prev.meaningVi}; ${meaningVi}`;
      continue;
    }
    const item = {
      id: itemId(kind, e.expression),
      kind,
      expression: e.expression,
      reading: kind === 'VOCAB' && e.reading && KANJI.test(e.expression) ? e.reading : null,
      hanviet: kind === 'VOCAB' ? spellHanviet(e.expression, hv) : null,
      meaningVi,
      level: e.level,
      notes: notesFor(e),
      tags: '',
      source: 'OPENJLPT' as const,
      suspended: false as const,
      starred: false as const,
    };
    byKey.set(key, item);
    out.items.push(item);
  }
  for (const item of out.items) {
    item.tags = JSON.stringify(['openjlpt', `jlpt-${item.level.toLowerCase()}`]);
    out.srsStates.push({
      id: `${item.id}-srs`,
      itemId: item.id,
      due: now.toISOString(),
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      lastReview: null,
    });
  }
  return out;
}
