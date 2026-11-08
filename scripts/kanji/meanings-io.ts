// Shared file access for the meanings-*.ts scripts (KJ1b, docs/codex/2026-11-08-kanji-meanings-brief.md).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { KanjiRow } from '../../lib/kanji/data.ts';
import { formatMeanings } from '../../lib/kanji/meanings.ts';

export const DIR = path.join(process.cwd(), 'data/kanji');
export const MEANINGS = path.join(DIR, 'meanings-vi.json');

export async function readRows(): Promise<KanjiRow[]> {
  return JSON.parse(await readFile(path.join(DIR, 'kanji.json'), 'utf8'));
}

export async function readMeanings(): Promise<Record<string, string>> {
  return JSON.parse(await readFile(MEANINGS, 'utf8'));
}

export async function writeMeanings(rows: KanjiRow[], meanings: Record<string, string>) {
  await writeFile(
    MEANINGS,
    formatMeanings(
      rows.map((r) => r.kanji),
      meanings,
    ),
  );
}

export function flag(name: string): number | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? Number(process.argv[i + 1]) : undefined;
}
