// The OpenJLPT deck built from the files in data/openjlpt with the builder the import file uses. It
// seeds the shared library (lib/library/seed.ts, phase 8) and backs Kaiwa's word meanings; since L4 a
// new learner no longer gets a copy of it (docs/decisions/0008-shared-library.md).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildImport, type BuildResult } from '@/lib/import/openjlpt';

export type StarterItem = BuildResult['items'][number];

const DATA_DIR = path.join(process.cwd(), 'data/openjlpt');

export async function loadStarterDeck(dir = DATA_DIR): Promise<StarterItem[]> {
  const read = async (file: string) => JSON.parse(await readFile(path.join(dir, file), 'utf8'));
  const [src, vi, hv, overrides] = await Promise.all([
    read('source.json'),
    read('vi.json'),
    read('hanviet-kanji.json'),
    read('hanviet-overrides.json'),
  ]);
  return buildImport(src, vi, hv, new Date(), overrides.words).items;
}
