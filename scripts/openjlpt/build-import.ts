// Phase 3.4: build data/openjlpt/sakubun-import.json (account-backup format) for Settings → Nhập dữ liệu.
//   node scripts/openjlpt/build-import.ts        (Node 24 runs TypeScript directly)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildImport } from '../../lib/import/openjlpt.ts';

const DIR = path.join(process.cwd(), 'data/openjlpt');
const read = async (f: string) => JSON.parse(await readFile(path.join(DIR, f), 'utf8'));

const src = await read('source.json');
const vi = await read('vi.json');
const hv = await read('hanviet-kanji.json');
const r = buildImport(src, vi, hv, new Date());
await writeFile(
  path.join(DIR, 'sakubun-import.json'),
  JSON.stringify({ exportedAt: new Date().toISOString(), items: r.items, srsStates: r.srsStates }) +
    '\n',
);
const byKind = r.items.reduce<Record<string, number>>(
  (m, i) => ((m[i.kind] = (m[i.kind] ?? 0) + 1), m),
  {},
);
console.log(
  `items ${r.items.length} ${JSON.stringify(byKind)} · merged ${r.merged} · skipped ${r.skipped.length}` +
    ` · with hanviet ${r.items.filter((i) => i.hanviet).length}`,
);
