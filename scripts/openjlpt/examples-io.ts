// Shared file access for the examples-*.ts scripts (phase 8 C1, docs/codex/2026-10-28-examples-brief.md).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OjSource } from '../../lib/import/openjlpt.ts';
import { entriesWithExample, type ExamplesFile } from '../../lib/import/examples-data.ts';

export const DIR = path.join(process.cwd(), 'data/openjlpt');
export const EXAMPLES = path.join(DIR, 'examples.json');

export async function readSource(): Promise<OjSource> {
  return JSON.parse(await readFile(path.join(DIR, 'source.json'), 'utf8'));
}

export async function readVi(): Promise<Record<string, { meaningVi: string }>> {
  return JSON.parse(await readFile(path.join(DIR, 'vi.json'), 'utf8'));
}

export async function readExamples(): Promise<ExamplesFile> {
  return JSON.parse(await readFile(EXAMPLES, 'utf8'));
}

// One entry per line, in source order, so a batch shows up in a diff as the lines it added.
export async function writeExamples(source: OjSource, file: ExamplesFile): Promise<void> {
  const order = entriesWithExample(source).map((e) => e.id);
  const ids = order.filter((id) => id in file.entries);
  const lines = ids.map((id) => `    ${JSON.stringify(id)}: ${JSON.stringify(file.entries[id])}`);
  const body = lines.length ? `\n${lines.join(',\n')}\n  ` : '';
  await writeFile(EXAMPLES, `{\n  "version": 1,\n  "entries": {${body}}\n}\n`);
}

export function flag(name: string): number | null {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : null;
}
