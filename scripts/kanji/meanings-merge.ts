// Adds one batch to data/kanji/meanings-vi.json. The batch is a JSON object {kanji: meaning} in the
// format of docs/codex/2026-11-08-kanji-meanings-brief.md. Nothing is written if any entry fails.
//   node scripts/kanji/meanings-merge.ts <batch.json>
import { readFile } from 'node:fs/promises';
import { checkMeanings } from '../../lib/kanji/meanings.ts';
import { readMeanings, readRows, writeMeanings } from './meanings-io.ts';

const file = process.argv[2];
if (!file) {
  console.error('Cách dùng: node scripts/kanji/meanings-merge.ts <batch.json>');
  process.exit(2);
}
const batch = JSON.parse(await readFile(file, 'utf8')) as Record<string, string>;
const rows = await readRows();
const kanji = rows.map((r) => r.kanji);
const report = checkMeanings(kanji, batch);
if (report.errors.length) {
  console.error(`Lô có ${report.errors.length} lỗi, chưa ghi gì:`);
  for (const e of report.errors) console.error(`- ${e}`);
  process.exit(1);
}
const current = await readMeanings();
const replaced = Object.keys(batch).filter((k) => k in current).length;
await writeMeanings(rows, { ...current, ...batch });
const after = checkMeanings(kanji, await readMeanings());
console.log(
  `Đã thêm ${Object.keys(batch).length - replaced} chữ, sửa ${replaced} chữ. ` +
    `Tổng ${after.done}/${after.total}, còn ${after.missing}.`,
);
