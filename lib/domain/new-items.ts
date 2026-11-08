import { JLPT_LEVELS, type JlptLevel } from '@/lib/settings/schema';

// Which new items to introduce, as pure logic (plan 2026-11-07-translation-difficulty, D): one kind
// at a time, from the level the learner studies and the easier levels they have not finished.
// Three in every four new items come from the level studied, the fourth from the nearest easier
// level with items left, so gaps below fill in without holding the learner back. Harder levels
// never come in. lib/app/queue.ts reads the candidates.

export interface NewCandidate {
  id: string;
  level: string;
  // The item came from a list (OpenJLPT, Kho chung) rather than from the learner's own hand.
  listed: boolean;
  createdAt: Date;
  // What fixes a listed item's place in its level: kind and expression, the same in every account.
  key: string;
}

// Every fourth new item of a kind, counted over all the learner has started, is an easier one.
export const EASIER_EVERY = 4;

// The levels new items may come from for a learner at `level`: that level, then the easier ones,
// nearest first.
export function levelsFrom(level: JlptLevel): JlptLevel[] {
  return JLPT_LEVELS.slice(0, JLPT_LEVELS.indexOf(level) + 1).reverse();
}

// FNV-1a: a stable, well spread number for a string, so a list's order inside a level is mixed
// the same way every time. OpenJLPT lists each level in gojūon order (あ words first), which would
// otherwise bring in a whole level one kana row at a time.
function spread(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Inside one level: what the learner added themselves first, oldest first; then the listed items
// in their stable mixed order.
function byIntroduction(a: NewCandidate, b: NewCandidate): number {
  if (a.listed !== b.listed) return a.listed ? 1 : -1;
  if (!a.listed) return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
  return spread(a.key) - spread(b.key) || a.key.localeCompare(b.key);
}

// The ids of the next `take` new items, in the order to introduce them. `started` is how many items
// of this kind the learner has begun, so the one-in-four rhythm carries over from day to day.
export function pickNewItems(
  candidates: readonly NewCandidate[],
  level: JlptLevel,
  started: number,
  take: number,
): string[] {
  const [current, ...easier] = levelsFrom(level).map((l) =>
    candidates.filter((c) => c.level === l).sort(byIntroduction),
  );
  const atLevel = [...current];
  const below = easier.flat();
  const picked: string[] = [];
  for (let i = 0; i < take && atLevel.length + below.length > 0; i++) {
    const wantEasier = (started + i) % EASIER_EVERY === EASIER_EVERY - 1;
    const from = (wantEasier && below.length > 0) || atLevel.length === 0 ? below : atLevel;
    picked.push(from.shift()!.id);
  }
  return picked;
}
