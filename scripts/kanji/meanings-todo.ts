// Prints the next kanji that data/kanji/meanings-vi.json has no meaning for yet, as the input of one
// batch (docs/codex/2026-11-08-kanji-meanings-brief.md). Easiest level first, then the most used.
//   node scripts/kanji/meanings-todo.ts [--count 200]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OjSource } from '../../lib/import/openjlpt.ts';
import { flag, readMeanings, readRows } from './meanings-io.ts';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const rows = await readRows();
const done = await readMeanings();
const oj = path.join(process.cwd(), 'data/openjlpt');
const source = JSON.parse(await readFile(path.join(oj, 'source.json'), 'utf8')) as OjSource;
const vi = JSON.parse(await readFile(path.join(oj, 'vi.json'), 'utf8')) as Record<
  string,
  { meaningVi: string }
>;

// Up to three OpenJLPT words written with the kanji, easiest first, with their Vietnamese meaning:
// what the kanji means inside words the learner will meet.
const words = new Map<string, { word: string; reading: string; vi: string }[]>();
for (const v of [...source.vocab].sort(
  (a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level),
)) {
  for (const ch of new Set(v.expression)) {
    const list = words.get(ch) ?? [];
    if (list.length < 3 && vi[v.id]?.meaningVi)
      list.push({ word: v.expression, reading: v.reading ?? '', vi: vi[v.id].meaningVi });
    words.set(ch, list);
  }
}

const rank = (r: (typeof rows)[number]) => [r.level ? LEVELS.indexOf(r.level) : 9, r.freq ?? 9999];
const todo = rows
  .filter((r) => !(r.kanji in done))
  .sort((a, b) => {
    const [la, fa] = rank(a);
    const [lb, fb] = rank(b);
    return la - lb || fa - fb;
  });
const pick = todo.slice(0, flag('--count') ?? 200);
const out = pick.map((r) => ({
  kanji: r.kanji,
  hanviet: r.hanviet,
  level: r.level,
  meaningEn: r.meaningEn,
  on: r.on,
  kun: r.kun,
  words: words.get(r.kanji) ?? [],
}));
console.log(JSON.stringify(out, null, 1));
console.error(`${out.length} chữ; còn ${todo.length} chữ chưa có nghĩa`);
