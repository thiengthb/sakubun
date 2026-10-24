// Data migration for readings confirmed or corrected after the import: spells every OpenJLPT word with the
// old kanji table and with the new one plus hanviet-overrides.json, and writes an UPDATE for each word
// whose reading appears or changes (lib/import/hanviet-fill.ts). Pass the old overrides file too when the
// old state already had word overrides (every fill after 20261024070000_hanviet_fill).
//   git show <old-commit>:data/openjlpt/hanviet-kanji.json > /tmp/old.json
//   git show <old-commit>:data/openjlpt/hanviet-overrides.json > /tmp/old-overrides.json
//   node scripts/openjlpt/hanviet-fill.ts /tmp/old.json prisma/migrations/<timestamp>_<name>/migration.sql [/tmp/old-overrides.json]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hanvietFillSql } from '../../lib/import/hanviet-fill.ts';
import { buildImport } from '../../lib/import/openjlpt.ts';

const [oldTablePath, outPath, oldOverridesPath] = process.argv.slice(2);
if (!oldTablePath || !outPath)
  throw new Error('usage: hanviet-fill.ts <old-table.json> <migration.sql> [old-overrides.json]');

const DIR = path.join(process.cwd(), 'data/openjlpt');
const read = async (f: string) => JSON.parse(await readFile(f, 'utf8'));
const src = await read(path.join(DIR, 'source.json'));
const vi = await read(path.join(DIR, 'vi.json'));
const now = new Date();
const oldWords = oldOverridesPath ? (await read(oldOverridesPath)).words : {};
const before = buildImport(src, vi, await read(oldTablePath), now, oldWords).items;
const { words } = await read(path.join(DIR, 'hanviet-overrides.json'));
const after = buildImport(
  src,
  vi,
  await read(path.join(DIR, 'hanviet-kanji.json')),
  now,
  words,
).items;

const sql = hanvietFillSql(before, after);
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  `-- Hán Việt for OpenJLPT words whose readings were confirmed or corrected later (scripts/openjlpt/hanviet-fill.ts).\n` +
    `-- Only rows still holding what the import wrote (no reading, or the old spelling) are touched.\n${sql}\n`,
);
console.log(`${sql ? sql.split('\n').length : 0} words gain or correct a reading`);
