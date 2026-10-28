// How much of each shared group the learner has already (thien, 7.4h: "Đã có 12/81"). Pure: the
// groups' members and the learner's items in, a count per group out. A learner has an entry when
// they have an item of the same kind and expression (rule 2), however they came by it.

export interface GroupMemberKey {
  groupEntryId: string;
  type: string;
  expression: string | null;
}

export function countOwned(
  members: readonly GroupMemberKey[],
  items: readonly { kind: string; expression: string }[],
): Map<string, number> {
  const key = (kind: string, expression: string) => `${kind}\u0000${expression}`;
  const have = new Set(items.map((i) => key(i.kind, i.expression)));
  const counts = new Map<string, number>();
  for (const m of members) {
    const owned = m.expression !== null && have.has(key(m.type, m.expression));
    counts.set(m.groupEntryId, (counts.get(m.groupEntryId) ?? 0) + Number(owned));
  }
  return counts;
}
