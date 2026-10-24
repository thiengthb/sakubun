// Hán Việt readings confirmed or corrected after the OpenJLPT words were imported, as SQL for a data
// migration. Item ids are stable across builds, so the imported rows are found by id. A row is changed
// only while it still holds what the earlier build wrote there (no reading, or the old spelling): a
// reading the learner typed in, or an item they deleted, is left alone. A reading is never removed.

type Row = { id: string; kind: string; hanviet: string | null };

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function hanvietFillSql(before: Row[], after: Row[]): string {
  const had = new Map(before.map((r) => [r.id, r.hanviet]));
  return after
    .filter((r) => r.kind === 'VOCAB' && r.hanviet && had.has(r.id) && had.get(r.id) !== r.hanviet)
    .map((r) => {
      const old = had.get(r.id);
      return (
        `UPDATE "Item" SET "hanviet" = ${quote(r.hanviet!)} WHERE "id" = ${quote(r.id)}` +
        ` AND "source" = 'OPENJLPT' AND "hanviet" ${old ? `= ${quote(old)}` : 'IS NULL'};`
      );
    })
    .join('\n');
}
