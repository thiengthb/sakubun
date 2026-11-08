// Reads data/kanji/ once per process for lib/kanji/catalog.ts (KJ2). The Docker image copies the folder.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildKanjiCatalog, type KanjiEntry } from '@/lib/kanji/catalog';
import type { RadicalRow } from '@/lib/kanji/data';
import { partIndex } from '@/lib/kanji/network';

let cached: Promise<KanjiEntry[]> | null = null;

export function kanjiCatalog(): Promise<KanjiEntry[]> {
  const read = async (file: string) =>
    JSON.parse(await readFile(path.join(process.cwd(), 'data/kanji', file), 'utf8'));
  cached ??= Promise.all([
    read('kanji.json'),
    read('meanings-vi.json'),
    read('radicals.json'),
  ]).then(([rows, meanings, radicals]) => buildKanjiCatalog(rows, meanings, radicals));
  return cached;
}

let strokes: Promise<Record<string, string[]>> | null = null;

/** KanjiVG's strokes of each Jōyō kanji, in order, as SVG path data in a 109 × 109 box (KJ4). */
export function kanjiStrokes(): Promise<Record<string, string[]>> {
  strokes ??= readFile(path.join(process.cwd(), 'data/kanji/strokes.json'), 'utf8').then(
    (text) => JSON.parse(text) as Record<string, string[]>,
  );
  return strokes;
}

let radicals: Promise<RadicalRow[]> | null = null;

/** The 214 Kangxi radicals with their Vietnamese names and variant forms (KJ6, KJ7). */
export function kanjiRadicals(): Promise<RadicalRow[]> {
  radicals ??= readFile(path.join(process.cwd(), 'data/kanji/radicals.json'), 'utf8').then(
    (text) => JSON.parse(text) as RadicalRow[],
  );
  return radicals;
}

let parts: Promise<Map<string, KanjiEntry[]>> | null = null;

/** Which kanji each visible part appears in (KJ6), built once. */
export function kanjiPartIndex(): Promise<Map<string, KanjiEntry[]>> {
  parts ??= kanjiCatalog().then(partIndex);
  return parts;
}
