import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ClozeExample } from '@/lib/domain/cloze';
import { resolveSpans, rubyFromFurigana, type ExamplesFile } from '@/lib/import/examples-data';
import type { OjSource } from '@/lib/import/openjlpt';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';

// The OpenJLPT example sentence of an item with what data/openjlpt/examples.json adds to it: the
// Vietnamese translation, the furigana, where the item stands, and the formation in Vietnamese
// (docs/plans/2026-10-28-quick-review.md, C2). An item from OpenJLPT, from Kho chung or added by hand
// gets it when its kind and expression match an OpenJLPT entry.

export type OpenJlptExample =
  { skip: true } | { skip: false; example: ClozeExample | null; formationVi: string | null };

const key = (kind: string, expression: string) =>
  `${kind}\u0000${expression.normalize('NFKC').trim()}`;

export function buildOpenJlptExamples(
  source: OjSource,
  file: ExamplesFile,
): Map<string, OpenJlptExample> {
  const out = new Map<string, OpenJlptExample>();
  const rows = [
    ...source.grammar.map((e) => [GRAMMAR_KIND, e] as const),
    ...source.vocab.map((e) => [VOCAB_KIND, e] as const),
  ];
  for (const [kind, e] of rows) {
    const k = key(kind, e.expression);
    const data = file.entries[e.id];
    // The same word at two levels keeps its first (easier) entry, as the import does.
    if (out.has(k) || !data || !e.example) continue;
    if (data.skip) {
      out.set(k, { skip: true });
      continue;
    }
    const placed = data.span ? resolveSpans(e.example.ja, data.span) : null;
    out.set(k, {
      skip: false,
      formationVi: data.formationVi ?? null,
      example: {
        ja: e.example.ja,
        vi: data.vi ?? null,
        jaRuby: e.example.furigana ? rubyFromFurigana(e.example.furigana) : null,
        spans: placed?.ok ? placed.spans : undefined,
      },
    });
  }
  return out;
}

export function openJlptExample(
  examples: Map<string, OpenJlptExample>,
  kind: string,
  expression: string,
): OpenJlptExample | null {
  return examples.get(key(kind, expression)) ?? null;
}

let cached: Promise<Map<string, OpenJlptExample>> | null = null;

// Built once per process from data/openjlpt/source.json and examples.json.
export function openJlptExamples(): Promise<Map<string, OpenJlptExample>> {
  const read = async (file: string) =>
    JSON.parse(await readFile(path.join(process.cwd(), 'data/openjlpt', file), 'utf8'));
  cached ??= Promise.all([read('source.json'), read('examples.json')]).then(([source, file]) =>
    buildOpenJlptExamples(source, file),
  );
  return cached;
}
