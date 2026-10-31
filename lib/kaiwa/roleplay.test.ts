import { describe, expect, it } from 'vitest';
import { parseScript } from '@/lib/kaiwa/parse';
import { findPart, roleplayScript } from '@/lib/kaiwa/roleplay';

const LINES = parseScript(
  [
    '店の中は静かだった。 | Trong quán yên tĩnh.',
    'A: いらっしゃいませ。 | Xin mời vào.',
    'Tanaka: 二人[ふたり]です。 | Hai người.',
    'A: こちらへどうぞ。',
  ].join('\n'),
);

describe('findPart', () => {
  it('matches a part without case', () => {
    expect(findPart(['A', 'Ta'], 'a')).toBe('A');
    expect(findPart(['A', 'Ta'], ' ta ')).toBe('Ta');
    expect(findPart(['A', 'Ta'], 'B')).toBeNull();
  });
});

describe('roleplayScript', () => {
  it('numbers the turns by who says them, readings dropped, meanings kept', () => {
    const result = roleplayScript('Ở quán', LINES, 'ta');
    if (!result.ok) throw new Error(result.error);
    const rows = result.text.split('\n');
    expect(rows[0]).toBe('Role-play "Ở quán": the learner is Ta, you play A. 4 turns.');
    expect(rows.slice(1, 5)).toEqual([
      '1 SCENE: 店の中は静かだった。 | Trong quán yên tĩnh.',
      '2 YOU A: いらっしゃいませ。 | Xin mời vào.',
      '3 LEARNER Ta: 二人です。 | Hai người.',
      '4 YOU A: こちらへどうぞ。',
    ]);
    expect(result.text).toContain("Never write the learner's line before they try.");
  });

  it('names the real parts when the learner asks for one the script does not have', () => {
    expect(roleplayScript('Ở quán', LINES, 'B')).toEqual({
      ok: false,
      error: 'No part "B". Parts: A, Ta.',
    });
  });

  it('refuses a monologue and points to the web practice', () => {
    const mono = parseScript('はじめまして。 | Rất vui được gặp.\nA: よろしく。');
    const result = roleplayScript('Giới thiệu', mono, 'A');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Nghe cả bài');
  });
});
