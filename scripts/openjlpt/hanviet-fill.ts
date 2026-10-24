// Data migration for readings confirmed after the import: spells every OpenJLPT word with the old and
// the new kanji table and writes an UPDATE for each word that gains a reading (lib/import/hanviet-fill.ts).
//   git show <old-commit>:data/openjlpt/hanviet-kanji.json > /tmp/old.json
//   node scripts/openjlpt/hanviet-fill.ts /tmp/old.json prisma/migrations/<timestamp>_<name>/migration.sql
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hanvietFillSql } from '../../lib/import/hanviet-fill.ts';
import { buildImport } from '../../lib/import/openjlpt.ts';

const [oldTablePath, outPath] = process.argv.slice(2);
if (!oldTablePath || !outPath) throw new Error('usage: hanviet-fill.ts <old-table.json> <migration.sql>');

const DIR = path.join(process.cwd(), 'data/openjlpt');
const read = async (f: string) => JSON.parse(await readFile(f, 'utf8'));
const src = await read(path.join(DIR, 'source.json'));
const vi = await read(path.join(DIR, 'vi.json'));
const now = new Date();
const before = buildImport(src, vi, await read(oldTablePath), now).items;
const after = buildImport(src, vi, await read(path.join(DIR, 'hanviet-kanji.json')), now).items;

const sql = hanvietFillSql(before, after);
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  `-- Fill Hán Việt for OpenJLPT words whose kanji readings were confirmed later (scripts/openjlpt/hanviet-fill.ts).\n` +
    `-- Only rows still without a reading are touched.\n${sql}\n`,
);
console.log(`${sql ? sql.split('\n').length : 0} words gain a reading`);
