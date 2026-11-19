import { REVIEW_STATE } from '@/lib/srs/retention';

// One JLPT level of one kind, cut into sets (U4c, docs/plans/2026-11-14-u4-kho.md): the level's
// OpenJLPT group in its own order, SET_SIZE entries a set, each with what the learner has made of
// it. Pure: the group's entries and the learner's items in, the sets and what to do next out.
// Sets are worked out on every visit and never stored, so a word added to the group later only
// shifts the sets after it.

export const SET_SIZE = 20;
export const FORGOTTEN_LIMIT = 9;

const NEW_STATE = 0;

// none: not in the learner's Kho yet. new: taken, never reviewed. paused: suspended.
export type WordState = 'none' | 'new' | 'learning' | 'due' | 'mastered' | 'paused';

export const WORD_STATES: readonly WordState[] = [
  'mastered',
  'learning',
  'due',
  'new',
  'none',
  'paused',
];

export interface SetEntry {
  // The OpenJLPT entry's id, what "Học" takes (U4d).
  id: string;
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string | null;
}

export interface SetItem {
  id: string;
  expression: string;
  suspended: boolean;
  // FSRS state, due date and lapses; null before the item has a schedule.
  state: number | null;
  due: Date | null;
  lapses: number;
}

export interface SetWord {
  entry: SetEntry;
  item: SetItem | null;
  state: WordState;
}

export type StateCounts = Record<WordState, number>;

export interface LevelSet {
  // 1-based, as the learner reads it ("Chặng 3").
  number: number;
  words: SetWord[];
  counts: StateCounts;
}

export interface LevelSets {
  sets: LevelSet[];
  counts: StateCounts;
  // Items in the FSRS Review state and not suspended, due or not: the "đã thuộc" of the level
  // board (level-tally.ts), so both screens give the same number.
  mastered: number;
  next: NextStep | null;
  forgotten: SetWord[];
}

// The set "Học chặng N" opens: the first one with words taken but never studied; failing that,
// the first one with words still to take.
export interface NextStep {
  set: number;
  kind: 'study' | 'take';
  count: number;
}

export function wordState(item: SetItem | null, now: Date): WordState {
  if (!item) return 'none';
  if (item.suspended) return 'paused';
  if (item.state === null || item.state === NEW_STATE) return 'new';
  if (item.due && item.due.getTime() <= now.getTime()) return 'due';
  return item.state === REVIEW_STATE ? 'mastered' : 'learning';
}

const emptyCounts = (): StateCounts => ({
  none: 0,
  new: 0,
  learning: 0,
  due: 0,
  mastered: 0,
  paused: 0,
});

export function levelSets(
  entries: readonly SetEntry[],
  items: readonly SetItem[],
  now: Date,
): LevelSets {
  const owned = new Map(items.map((i) => [i.expression, i]));
  const seen = new Set<string>();
  const words: SetWord[] = [];
  for (const entry of entries) {
    // A word listed twice in a group counts once, where it first appears.
    if (seen.has(entry.expression)) continue;
    seen.add(entry.expression);
    const item = owned.get(entry.expression) ?? null;
    words.push({ entry, item, state: wordState(item, now) });
  }

  const counts = emptyCounts();
  const sets: LevelSet[] = [];
  for (let start = 0; start < words.length; start += SET_SIZE) {
    const slice = words.slice(start, start + SET_SIZE);
    const setCounts = emptyCounts();
    for (const w of slice) {
      setCounts[w.state] += 1;
      counts[w.state] += 1;
    }
    sets.push({ number: sets.length + 1, words: slice, counts: setCounts });
  }

  const mastered = words.filter(
    (w) => w.item && !w.item.suspended && w.item.state === REVIEW_STATE,
  ).length;
  return { sets, counts, mastered, next: nextStep(sets), forgotten: mostForgotten(words) };
}

export function nextStep(sets: readonly LevelSet[]): NextStep | null {
  const study = sets.find((s) => s.counts.new > 0);
  if (study) return { set: study.number, kind: 'study', count: study.counts.new };
  const take = sets.find((s) => s.counts.none > 0);
  if (take) return { set: take.number, kind: 'take', count: take.counts.none };
  return null;
}

// Words the learner forgot at least once, most lapses first; ties keep the group's order.
export function mostForgotten(words: readonly SetWord[], limit = FORGOTTEN_LIMIT): SetWord[] {
  return words
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.item !== null && !w.item.suspended && w.item.lapses > 0)
    .sort((a, b) => b.w.item!.lapses - a.w.item!.lapses || a.i - b.i)
    .slice(0, limit)
    .map(({ w }) => w);
}
