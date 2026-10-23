import { describe, expect, it } from 'vitest';
import {
  answerSurface,
  BLANK,
  buildCloze,
  canBlank,
  CLOZE_CHOICES,
  type ClozeItem,
} from '@/lib/domain/cloze';
import { normalizeExpression } from '@/lib/core/normalize';
import { segmentsText } from '@/lib/domain/sentence';

function vocab(id: string, expression: string, level = 'N4', reading: string | null = null) {
  return { id, kind: 'VOCAB', expression, reading, level } satisfies ClozeItem;
}

const TARGET = vocab('t', '約束', 'N4', 'やくそく');
const EXAMPLE = {
  ja: '友達と約束をしました。',
  vi: 'Tôi đã hẹn với bạn.',
  jaRuby: '友達[ともだち]と約束[やくそく]をしました。',
};
const POOL: ClozeItem[] = [
  vocab('a', '準備', 'N4'),
  vocab('b', '練習', 'N4'),
  vocab('c', '連絡', 'N4'),
  vocab('d', '相談', 'N3'),
  vocab('e', '予定', 'N5'),
  vocab('f', '経験', 'N2'),
];

describe('canBlank', () => {
  it('needs the answer exactly once, at least two characters, in a 6-90 character sentence', () => {
    expect(canBlank('約束', '友達と約束をしました。')).toBe(true);
    expect(canBlank('約束', '約束は約束です。とても大事。')).toBe(false); // twice: the answer leaks
    expect(canBlank('約束', '天気がいいですね。')).toBe(false); // absent
    expect(canBlank('木', 'あの木は大きいです。')).toBe(false); // one character
    expect(canBlank('約束', '約束だ。')).toBe(false); // too short
    expect(canBlank('約束', `約束${'あ'.repeat(90)}`)).toBe(false); // too long
  });

  it('blanks grammar without its decoration', () => {
    expect(answerSurface('〜てもいい')).toBe('てもいい');
    expect(canBlank(answerSurface('〜てもいい'), 'ここで写真を撮ってもいいですか。')).toBe(true);
  });
});

describe('buildCloze', () => {
  const build = (seed: number) =>
    buildCloze({ target: TARGET, examples: [EXAMPLE], pool: POOL, seed });

  it('has four distinct choices and exactly one right answer', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const cloze = build(seed)!;
      expect(cloze.choices).toHaveLength(CLOZE_CHOICES);
      const keys = cloze.choices.map((c) => normalizeExpression(c.expression));
      expect(new Set(keys).size).toBe(CLOZE_CHOICES);
      expect(cloze.choices.filter((c) => c.itemId === TARGET.id)).toHaveLength(1);
      expect(cloze.choices[cloze.answerIndex].itemId).toBe(TARGET.id);
    }
  });

  it('never shows the answer in the sentence or its furigana', () => {
    const cloze = build(7)!;
    expect(cloze.prompt).toBe(`友達と${BLANK}をしました。`);
    expect(cloze.sentence).toEqual([
      { text: '友達', reading: 'ともだち' },
      { text: 'と' },
      { text: '', mark: 'blank' },
      { text: 'をしました。' },
    ]);
    expect(segmentsText(cloze.sentence)).toBe(cloze.prompt);
    expect(cloze.prompt).not.toContain('約束');
    expect(JSON.stringify(cloze.sentence)).not.toMatch(/約束|やくそく/);
    expect(cloze.translation).toBe(EXAMPLE.vi);
  });

  it('is the same card for the same seed, and the right answer moves between seeds', () => {
    expect(build(42)).toEqual(build(42));
    const positions = new Set(Array.from({ length: 40 }, (_, i) => build(i + 1)!.answerIndex));
    expect(positions.size).toBeGreaterThan(1);
  });

  it('prefers distractors at the same level, then the nearest one', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ids = build(seed)!.choices.map((c) => c.itemId);
      expect(ids).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    }
  });

  it('skips distractors that could also be right or already stand in the sentence', () => {
    const pool = [
      vocab('dup', '約束', 'N4'), // same word under another id
      vocab('long', '約束する', 'N4'), // contains the answer
      vocab('seen', '友達', 'N4'), // already in the sentence
      vocab('gram', 'てもいい', 'N4'),
      ...POOL.slice(3),
    ].map((item) => (item.id === 'gram' ? { ...item, kind: 'GRAMMAR' as const } : item));
    const cloze = buildCloze({ target: TARGET, examples: [EXAMPLE], pool, seed: 3 })!;
    expect(cloze.choices.map((c) => c.itemId).sort()).toEqual(['d', 'e', 'f', 't']);
  });

  it('returns null when no sentence can be blanked or fewer than three distractors exist', () => {
    const ambiguous = { ja: '約束は約束です。守りましょう。' };
    expect(buildCloze({ target: TARGET, examples: [ambiguous], pool: POOL, seed: 1 })).toBeNull();
    expect(buildCloze({ target: TARGET, examples: [], pool: POOL, seed: 1 })).toBeNull();
    expect(
      buildCloze({ target: TARGET, examples: [EXAMPLE], pool: POOL.slice(0, 2), seed: 1 }),
    ).toBeNull();
  });

  it('uses only sentences that can be blanked', () => {
    const examples = [{ ja: '約束は約束です。守りましょう。' }, EXAMPLE];
    for (let seed = 1; seed <= 10; seed++) {
      expect(buildCloze({ target: TARGET, examples, pool: POOL, seed })!.prompt).toBe(
        `友達と${BLANK}をしました。`,
      );
    }
  });
});
