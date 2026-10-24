// Hán Việt readings confirmed after the OpenJLPT words were imported, as SQL for a data migration.
// Item ids are stable across builds, so the imported rows are found by id. Only a row that still has
// no reading is filled: a reading the learner typed in, or an item they deleted, is left alone.

type Row = { id: string; kind: string; hanviet: string | null };

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function hanvietFillSql(before: Row[], after: Row[]): string {
  const had = new Map(before.map((r) => [r.id, r.hanviet]));
  return after
    .filter((r) => r.kind === 'VOCAB' && r.hanviet && had.has(r.id) && !had.get(r.id))
    .map(
      (r) =>
        `UPDATE "Item" SET "hanviet" = ${quote(r.hanviet!)} WHERE "id" = ${quote(r.id)}` +
        ` AND "source" = 'OPENJLPT' AND "hanviet" IS NULL;`,
    )
    .join('\n');
}
