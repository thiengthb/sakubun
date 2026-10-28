// Prints the next OpenJLPT example sentences that data/openjlpt/examples.json does not cover yet, as the
// input of one batch (docs/codex/2026-10-28-examples-brief.md).
//   node scripts/openjlpt/examples-todo.ts [--count 100]
//   node scripts/openjlpt/examples-todo.ts --sample 50   (spread over both kinds and every level)
import { entriesWithExample } from '../../lib/import/examples-data.ts';
import { flag, readExamples, readSource, readVi } from './examples-io.ts';

const source = await readSource();
const vi = await readVi();
const { entries } = await readExamples();
const todo = entriesWithExample(source).filter((e) => !(e.id in entries));

let pick = todo.slice(0, flag('--count') ?? 100);
const sample = flag('--sample');
if (sample) {
  // Grammar is 7% of the entries; give it a fair share of the sample.
  const grammar = todo.filter((e) => e.id.startsWith('g:'));
  const vocab = todo.filter((e) => !e.id.startsWith('g:'));
  const g = Math.min(grammar.length, Math.ceil(sample / 3));
  const every = (list: typeof todo, n: number) =>
    list.filter((_, i) => i % Math.max(1, Math.floor(list.length / n)) === 0).slice(0, n);
  pick = [...every(grammar, g), ...every(vocab, sample - g)];
}

const out = pick.map((e) => ({
  id: e.id,
  expression: e.expression,
  reading: e.reading ?? undefined,
  level: e.level,
  pos: e.pos,
  formation: e.formation ?? undefined,
  meaningEn: e.meaningEn,
  meaningVi: vi[e.id]?.meaningVi,
  ja: e.example!.ja,
  en: e.example!.en ?? undefined,
}));
console.log(JSON.stringify(out, null, 1));
console.error(`${out.length} mục; còn ${todo.length} mục chưa có trong examples.json`);
