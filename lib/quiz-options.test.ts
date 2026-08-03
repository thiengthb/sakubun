import { describe, expect, it } from 'vitest';
import {
  buildQuizOptions,
  MAX_DISTRACTOR_CANDIDATES,
  mergeDistractorCandidates,
  QUIZ_LETTERS,
} from '@/lib/quiz-options';

// A cycling rand, so a test can pin the shuffle instead of hoping.
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('the server owns the answer position', () => {
  it('returns four lettered options and says where the answer went', () => {
    const q = buildQuizOptions(
      '〜わけにはいかない',
      ['〜しかない', '〜ざるを得ない', '〜ほかない'],
      seq(0),
    );
    expect(q.options.map((o) => o.letter)).toEqual([...QUIZ_LETTERS]);
    expect(q.options).toHaveLength(4);
    expect(q.options.find((o) => o.letter === q.correctLetter)?.pattern).toBe('〜わけにはいかない');
  });

  it('renders the line ready to display verbatim', () => {
    const q = buildQuizOptions('A1', ['B1', 'C1', 'D1'], seq(0));
    expect(q.line).toBe(q.options.map((o) => `**${o.letter}.** ${o.pattern}`).join(' · '));
    expect(q.line).toMatch(/^\*\*A\.\*\* /);
  });

  it('does NOT park the answer at one letter — every slot is reachable', () => {
    // The learner's report was "the answer keeps coming out C". With the placement moved off the
    // prompt and into the shuffle, hitting all four slots is a property of the code, provable here
    // rather than argued about from a handful of remembered questions.
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      seen.add(buildQuizOptions('target', ['d1', 'd2', 'd3']).correctLetter);
    }
    expect([...seen].sort()).toEqual([...QUIZ_LETTERS]);
  });

  it('spreads roughly evenly over many draws', () => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (let i = 0; i < 4000; i++) counts[buildQuizOptions('t', ['a', 'b', 'c']).correctLetter]++;
    // Loose band: this asserts "not parked", not a statistics lecture. A stuck slot lands at 0 or 4000.
    for (const letter of QUIZ_LETTERS) {
      expect(counts[letter]).toBeGreaterThan(600);
      expect(counts[letter]).toBeLessThan(1400);
    }
  });
});

describe('a question with two right answers is rejected before the learner sees it', () => {
  it('rejects a distractor that IS the answer', () => {
    expect(() => buildQuizOptions('〜ばかりに', ['〜ばかりに', 'x', 'y'])).toThrow(/KHÁC nhau/);
  });

  it('rejects a distractor that is the answer wearing different decoration', () => {
    // 「〜わけにはいかない」 vs 「わけにはいかない」 — the tilde and the quotes are decoration, so this is
    // the same option twice, and the learner is asked to choose between two identical answers.
    expect(() => buildQuizOptions('〜わけにはいかない', ['わけにはいかない', 'x', 'y'])).toThrow(
      /KHÁC nhau/,
    );
  });

  it('rejects two identical distractors', () => {
    expect(() => buildQuizOptions('t', ['dup', 'dup', 'z'])).toThrow(/KHÁC nhau/);
  });
});

describe('shape errors name what is wrong', () => {
  it('demands exactly three distractors', () => {
    expect(() => buildQuizOptions('t', ['a', 'b'])).toThrow(/đúng 3/);
    expect(() => buildQuizOptions('t', ['a', 'b', 'c', 'd'])).toThrow(/đúng 3/);
  });

  it('rejects blank entries', () => {
    expect(() => buildQuizOptions('  ', ['a', 'b', 'c'])).toThrow(/trống/);
    expect(() => buildQuizOptions('t', ['a', '   ', 'c'])).toThrow(/đúng 3/);
  });

  it('trims, so trailing whitespace is not a "different" option', () => {
    expect(() => buildQuizOptions('t', ['t  ', 'b', 'c'])).toThrow(/KHÁC nhau/);
  });
});

describe('candidate distractors come from the library, not from memory', () => {
  it('keeps the best tier first and drops the target', () => {
    const out = mergeDistractorCandidates('〜わけにはいかない', [
      ['〜しかない', '〜わけにはいかない'],
      ['〜ざるを得ない'],
    ]);
    expect(out).toEqual(['〜しかない', '〜ざるを得ない']);
  });

  it('treats a decoration-only difference as the SAME candidate', () => {
    // Otherwise the target reappears as its own distractor with the tilde stripped — the exact shape
    // buildQuizOptions later rejects, but discovered a whole question too late.
    const out = mergeDistractorCandidates('〜わけにはいかない', [
      ['わけにはいかない', '「〜しかない」', '〜しかない'],
    ]);
    expect(out).toEqual(['「〜しかない」']);
  });

  it('caps the list so it stays readable', () => {
    const many = Array.from({ length: 30 }, (_, i) => `p${i}`);
    expect(mergeDistractorCandidates('t', [many])).toHaveLength(MAX_DISTRACTOR_CANDIDATES);
  });

  it('skips blanks instead of emitting empty options', () => {
    expect(mergeDistractorCandidates('t', [['', '  ', 'real']])).toEqual(['real']);
  });
});
