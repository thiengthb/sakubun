import { describe, expect, it } from 'vitest';
import {
  cellHref,
  cellNote,
  studyLabels,
  tallyLevels,
  type BoardEntry,
  type BoardItem,
} from './level-tally';

const entry = (type: string, expression: string, level: string, listed = true): BoardEntry => ({
  type,
  expression,
  level,
  listed,
});
const item = (
  kind: string,
  expression: string,
  state: number | null,
  suspended = false,
): BoardItem => ({ kind, expression, state, suspended });

describe('tallyLevels', () => {
  const entries = [
    entry('GRAMMAR', '〜は', 'N5'),
    entry('GRAMMAR', '〜が', 'N5'),
    entry('VOCAB', '店', 'N5'),
    entry('VOCAB', '静か', 'N5'),
    entry('VOCAB', '切符', 'N4'),
  ];
  const kanji = [
    { kanji: '日', level: 'N5' },
    { kanji: '会', level: 'N4' },
  ];

  it('counts total, owned and mastered per level and kind', () => {
    const board = tallyLevels(entries, kanji, [
      item('GRAMMAR', '〜は', 2),
      item('VOCAB', '店', 1),
      item('VOCAB', '静か', 2),
      item('KANJI', '日', 2),
    ]);
    const n5 = board.levels.find((l) => l.level === 'N5')!;
    expect(n5.grammar).toEqual({ total: 2, have: 1, mastered: 1 });
    expect(n5.vocab).toEqual({ total: 2, have: 2, mastered: 1 });
    expect(n5.kanji).toEqual({ total: 1, have: 1, mastered: 1 });
    const n4 = board.levels.find((l) => l.level === 'N4')!;
    expect(n4.vocab).toEqual({ total: 1, have: 0, mastered: 0 });
    expect(n4.kanji).toEqual({ total: 1, have: 0, mastered: 0 });
  });

  it('lists every level from N5 to N1, empty ones too', () => {
    const board = tallyLevels([], [], []);
    expect(board.levels.map((l) => l.level)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1']);
    expect(board.levels[4]!.grammar).toEqual({ total: 0, have: 0, mastered: 0 });
  });

  it('keeps a suspended card out of mastered but in owned', () => {
    const board = tallyLevels(entries, [], [item('GRAMMAR', '〜は', 2, true)]);
    expect(board.levels[0]!.grammar).toEqual({ total: 2, have: 1, mastered: 0 });
  });

  it('does not count new, learning or relearning cards as mastered', () => {
    const board = tallyLevels(
      entries,
      [],
      [item('GRAMMAR', '〜は', null), item('GRAMMAR', '〜が', 3), item('VOCAB', '店', 0)],
    );
    expect(board.levels[0]!.grammar).toEqual({ total: 2, have: 2, mastered: 0 });
    expect(board.levels[0]!.vocab).toEqual({ total: 2, have: 1, mastered: 0 });
  });

  it('matches by kind and expression, not by the item level', () => {
    // A word the learner wrote has level N5 by default; matching an N4 entry puts it in N4.
    const board = tallyLevels(entries, [], [item('VOCAB', '切符', 2)]);
    expect(board.levels[1]!.vocab).toEqual({ total: 1, have: 1, mastered: 1 });
    expect(board.levels[0]!.vocab.have).toBe(0);
    // Same text, other kind: no match.
    expect(tallyLevels(entries, [], [item('GRAMMAR', '店', 2)]).levels[0]!.vocab.have).toBe(0);
  });

  it('counts items that match no entry as outside JLPT, kanji excepted', () => {
    const board = tallyLevels(entries, kanji, [
      item('GRAMMAR', '〜は', 2),
      item('VOCAB', '自分で書いた', null),
      item('GRAMMAR', '〜てしまう', 1),
      item('KANJI', '曜', null),
    ]);
    expect(board.outside).toBe(2);
  });

  it('leaves hidden entries out of totals, but their items are not outside', () => {
    const board = tallyLevels(
      [entry('VOCAB', '店', 'N5', false), entry('VOCAB', '静か', 'N5')],
      [],
      [item('VOCAB', '店', 2)],
    );
    expect(board.levels[0]!.vocab).toEqual({ total: 1, have: 0, mastered: 0 });
    expect(board.outside).toBe(0);
  });

  it('counts an expression once when it is listed twice, and skips odd rows', () => {
    const board = tallyLevels(
      [
        entry('VOCAB', '店', 'N5'),
        entry('VOCAB', '店', 'N5'),
        { type: 'VOCAB', expression: null, level: 'N5', listed: true },
        entry('GROUP', 'N5 · Từ vựng', 'N5'),
        entry('VOCAB', 'ほか', 'N6'),
      ],
      [{ kanji: '外', level: 'N6' }],
      [item('VOCAB', 'ほか', null)],
    );
    expect(board.levels[0]!.vocab).toEqual({ total: 1, have: 0, mastered: 0 });
    expect(board.levels.every((l) => l.kanji.total === 0)).toBe(true);
    // A word whose entry has no JLPT level is still a known entry, not outside.
    expect(board.outside).toBe(0);
  });
});

describe('cell helpers', () => {
  it('says what is left of a cell', () => {
    expect(cellNote({ total: 0, have: 0, mastered: 0 })).toBe('Kho chung chưa có mục nào');
    expect(cellNote({ total: 98, have: 0, mastered: 0 })).toBe('Chưa lấy');
    expect(cellNote({ total: 662, have: 660, mastered: 5 })).toBe('5 thuộc · còn 2 chưa lấy');
    expect(cellNote({ total: 415, have: 415, mastered: 0 })).toBe('0 thuộc · đủ cả cấp');
  });

  it('opens the level in Kho chung, kanji on their level page', () => {
    expect(cellHref('N4', 'vocab')).toBe('/library?tab=items&type=VOCAB&level=N4');
    expect(cellHref('N5', 'grammar')).toBe('/library?tab=items&type=GRAMMAR&level=N5');
    expect(cellHref('N3', 'kanji')).toBe('/library/kanji/N3');
  });

  it('puts "đang học" on the level, or on each cell when the kinds differ', () => {
    expect(studyLabels('N5', 'N5')).toEqual({ level: 'N5', grammar: null, vocab: null });
    expect(studyLabels('N4', 'N5')).toEqual({ level: null, grammar: 'N4', vocab: 'N5' });
  });
});
