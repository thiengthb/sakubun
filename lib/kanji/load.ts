// Reads data/kanji/ once per process for lib/kanji/catalog.ts (KJ2). The Docker image copies the folder.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildKanjiCatalog, type KanjiEntry } from '@/lib/kanji/catalog';

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
