// Adds one batch to data/openjlpt/examples.json. The batch is a JSON object {id: entry} in the format of
// docs/codex/2026-10-28-examples-brief.md. Nothing is written if any entry of the batch fails the check.
//   node scripts/openjlpt/examples-merge.ts <batch.json>
import { readFile } from 'node:fs/promises';
import { checkExamples, type ExampleEntry } from '../../lib/import/examples-data.ts';
import { readExamples, readSource, writeExamples } from './examples-io.ts';

const file = process.argv[2];
if (!file) {
  console.error('Cách dùng: node scripts/openjlpt/examples-merge.ts <batch.json>');
  process.exit(2);
}
const batch = JSON.parse(await readFile(file, 'utf8')) as Record<string, ExampleEntry>;
const source = await readSource();
const report = checkExamples(source, { version: 1, entries: batch });
if (report.errors.length) {
  console.error(`Lô có ${report.errors.length} lỗi, chưa ghi gì:`);
  for (const e of report.errors) console.error(`- ${e}`);
  process.exit(1);
}
const current = await readExamples();
const replaced = Object.keys(batch).filter((id) => id in current.entries).length;
await writeExamples(source, { version: 1, entries: { ...current.entries, ...batch } });
const after = checkExamples(source, await readExamples());
console.log(
  `Đã thêm ${Object.keys(batch).length - replaced} mục, sửa ${replaced} mục. ` +
    `Tổng ${after.done}/${after.total}, còn ${after.missing}.`,
);
