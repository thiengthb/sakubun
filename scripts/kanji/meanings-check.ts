// Checks the whole of data/kanji/meanings-vi.json (CI runs the same check in lib/kanji/meanings.test.ts).
//   node scripts/kanji/meanings-check.ts
import { checkMeanings } from '../../lib/kanji/meanings.ts';
import { readMeanings, readRows } from './meanings-io.ts';

const rows = await readRows();
const report = checkMeanings(
  rows.map((r) => r.kanji),
  await readMeanings(),
);
for (const e of report.errors) console.error(`- ${e}`);
console.log(
  `${report.errors.length} lỗi. Có nghĩa ${report.done}/${report.total}, còn ${report.missing}.`,
);
process.exit(report.errors.length ? 1 : 0);
