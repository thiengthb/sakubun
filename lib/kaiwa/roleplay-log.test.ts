import { describe, expect, it } from 'vitest';
import { parseScript } from '@/lib/kaiwa/parse';
import { checkRoleplay, readRoleplayTurns, ROLEPLAY_LIMITS } from '@/lib/kaiwa/roleplay-log';

const LINES = parseScript(
  [
    '店の中は静かだった。 | Trong quán yên tĩnh.',
    'A: いらっしゃいませ。 | Xin mời vào.',
    'B: 二人です。 | Hai người.',
    'A: こちらへどうぞ。 | Mời đi lối này.',
    'B: ありがとう。 | Cảm ơn.',
  ].join('\n'),
);

describe('checkRoleplay', () => {
  it('keeps the learner’s turns sorted and trimmed, and counts the right ones', () => {
    const checked = checkRoleplay(LINES, 'b', [
      { turn: 5, said: 'ありがとう ', ok: true },
      { turn: 3, said: ' 二人', ok: false, note: '  Thiếu です. ' },
    ]);
    expect(checked).toEqual({
      ok: true,
      part: 'B',
      correct: 1,
      turns: [
        { turn: 3, said: '二人', ok: false, note: 'Thiếu です.' },
        { turn: 5, said: 'ありがとう', ok: true },
      ],
    });
  });

  it('says what to fix', () => {
    const err = (turns: Parameters<typeof checkRoleplay>[2], part = 'B') => {
      const c = checkRoleplay(LINES, part, turns);
      return c.ok ? null : c.error;
    };
    expect(err([], 'C')).toBe('No part "C". Parts: A, B.');
    expect(err([])).toMatch(/^No turns/);
    expect(err([{ turn: 1, said: 'x', ok: true }])).toBe("Turn 1 is not B's. B's turns: 3, 5.");
    expect(err([{ turn: 2, said: 'x', ok: true }])).toBe("Turn 2 is not B's. B's turns: 3, 5.");
    expect(
      err([
        { turn: 3, said: 'x', ok: true },
        { turn: 3, said: 'y', ok: true },
      ]),
    ).toBe('Turn 3 is twice; send its last try once.');
    expect(err([{ turn: 3, said: '  ', ok: true }])).toBe('Turn 3: "said" is empty.');
    expect(err([{ turn: 3, said: 'あ'.repeat(ROLEPLAY_LIMITS.said + 1), ok: true }])).toMatch(
      /"said" is over/,
    );
    expect(
      err([{ turn: 3, said: 'x', ok: true, note: 'a'.repeat(ROLEPLAY_LIMITS.note + 1) }]),
    ).toMatch(/"note" is over/);
    expect(
      err(
        Array.from({ length: ROLEPLAY_LIMITS.turns + 1 }, () => ({ turn: 3, said: 'x', ok: true })),
      ),
    ).toMatch(/^At most 60 turns/);
  });
});

describe('readRoleplayTurns', () => {
  it('reads what was stored and drops what it cannot read', () => {
    expect(
      readRoleplayTurns(
        '[{"turn":3,"said":"x","ok":true,"model":{"japanese":"です","translation":null}},' +
          '{"turn":5,"said":"y","ok":false,"model":{"japanese":1}},{"turn":"4"}]',
      ),
    ).toEqual([
      { turn: 3, said: 'x', ok: true, model: { japanese: 'です', translation: null } },
      { turn: 5, said: 'y', ok: false, model: null },
    ]);
    expect(readRoleplayTurns('nope')).toEqual([]);
    expect(readRoleplayTurns('{}')).toEqual([]);
  });
});
