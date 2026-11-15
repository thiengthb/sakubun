import { REVIEW_STATE } from '@/lib/srs/retention';
import { JLPT_LEVELS } from '@/lib/kanji/data';
import { GRAMMAR_KIND, KANJI_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';

// The Kho screen's level board (U4a, docs/plans/2026-11-14-u4-kho.md › Cách đếm). Pure: the
// OpenJLPT entries, the kanji catalog and the learner's items in, one cell per level and kind out.
// A learner has an entry when they own an item of the same kind and expression (rule 2), never by
// `Item.level`, which defaults to N5 for items the learner wrote. Mastered is the FSRS Review state
// and not suspended, the same count as "đã thuộc" on Phân tích.

export type BoardLevel = (typeof JLPT_LEVELS)[number];

export interface LevelCell {
  total: number;
  have: number;
  mastered: number;
}

export interface LevelRow {
  level: BoardLevel;
  grammar: LevelCell;
  vocab: LevelCell;
  kanji: LevelCell;
}

export interface LevelBoard {
  levels: LevelRow[];
  // Grammar and vocab items that match no OpenJLPT entry: written by the learner, made with
  // Claude, or taken from a set someone shared.
  outside: number;
}

export interface BoardEntry {
  type: string;
  expression: string | null;
  level: string | null;
  // Hidden entries count toward no total, but an item taken from one is still not "outside".
  listed: boolean;
}

export interface BoardItem {
  kind: string;
  expression: string;
  suspended: boolean;
  // FSRS state, null before the first review.
  state: number | null;
}

const key = (kind: string, expression: string) => `${kind}\u0000${expression}`;
const isBoardLevel = (level: string | null): level is BoardLevel =>
  (JLPT_LEVELS as readonly (string | null)[]).includes(level);
const emptyCell = (): LevelCell => ({ total: 0, have: 0, mastered: 0 });
const isMastered = (item: BoardItem) => !item.suspended && item.state === REVIEW_STATE;

export function tallyLevels(
  entries: readonly BoardEntry[],
  kanji: readonly { kanji: string; level: string | null }[],
  items: readonly BoardItem[],
): LevelBoard {
  const owned = new Map(items.map((i) => [key(i.kind, i.expression), i]));
  const rows = new Map<BoardLevel, LevelRow>(
    JLPT_LEVELS.map((level) => [
      level,
      { level, grammar: emptyCell(), vocab: emptyCell(), kanji: emptyCell() },
    ]),
  );
  const add = (cell: LevelCell, item: BoardItem | undefined) => {
    cell.total += 1;
    if (!item) return;
    cell.have += 1;
    if (isMastered(item)) cell.mastered += 1;
  };

  const known = new Set<string>();
  // One listed entry per kind and expression is counted, so a word in two places counts once.
  const counted = new Set<string>();
  for (const e of entries) {
    if (!e.expression || (e.type !== GRAMMAR_KIND && e.type !== VOCAB_KIND)) continue;
    const k = key(e.type, e.expression);
    known.add(k);
    if (!e.listed || !isBoardLevel(e.level) || counted.has(k)) continue;
    counted.add(k);
    const row = rows.get(e.level)!;
    add(e.type === GRAMMAR_KIND ? row.grammar : row.vocab, owned.get(k));
  }
  for (const k of kanji) {
    if (!isBoardLevel(k.level)) continue;
    add(rows.get(k.level)!.kanji, owned.get(key(KANJI_KIND, k.kanji)));
  }

  const outside = items.filter(
    (i) =>
      (i.kind === GRAMMAR_KIND || i.kind === VOCAB_KIND) && !known.has(key(i.kind, i.expression)),
  ).length;
  return { levels: [...rows.values()], outside };
}
