// Checks data/openjlpt/examples.json against source.json (CI runs the same check in
// lib/import/examples-data.test.ts). With --review, also writes examples-review.md for a person to read.
//   node scripts/openjlpt/examples-check.ts [--review]
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { checkExamples, entriesWithExample, resolveSpans } from '../../lib/import/examples-data.ts';
import { DIR, readExamples, readSource } from './examples-io.ts';

const source = await readSource();
const file = await readExamples();
const report = checkExamples(source, file);
for (const e of report.errors) console.error(`- ${e}`);
console.log(
  `${report.done}/${report.total} câu (bỏ qua ${report.skipped}), còn ${report.missing}, lỗi ${report.errors.length}.`,
);

if (process.argv.includes('--review')) {
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  const rows = entriesWithExample(source)
    .filter((e) => e.id in file.entries)
    .map((e) => {
      const v = file.entries[e.id];
      const ja = e.example!.ja;
      const placed = v.span ? resolveSpans(ja, v.span) : null;
      let marked = ja;
      if (placed?.ok) {
        for (const s of [...placed.spans].reverse()) {
          marked = `${marked.slice(0, s.start)}**${marked.slice(s.start, s.end)}**${marked.slice(s.end)}`;
        }
      }
      const extra = [v.formationVi && `Cách nối: ${v.formationVi}`, v.skip && `BỎ: ${v.skip}`]
        .filter(Boolean)
        .join('<br>');
      return `| ${e.level} | ${cell(e.expression)} | ${cell(marked)} | ${cell(v.vi ?? '')} | ${cell(e.example!.en ?? '')} | ${cell(extra)} |`;
    });
  const md = [
    '# Câu ví dụ OpenJLPT: bản dịch để xem lại',
    '',
    'Đậm là phần của mục trong câu (span). Cột tiếng Anh là bản gốc của OpenJLPT, chỉ để đối chiếu.',
    '',
    '| Cấp | Mục | Câu | Tiếng Việt | Tiếng Anh (gốc) | Ghi chú |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
  await writeFile(path.join(DIR, 'examples-review.md'), md);
  console.log(`Đã ghi data/openjlpt/examples-review.md (${rows.length} dòng).`);
}
if (report.errors.length) process.exit(1);
