import { describe, expect, it } from 'vitest';
import { checkVoices, readVoices, speakerVoices } from '@/lib/kaiwa/voices';

// Voice ids from VOICE_SPEAKERS: 3 ずんだもん, 2 四国めたん, 8 春日部つむぎ (women);
// 11 玄野武宏, 13 青山龍星 (men).
describe('speakerVoices', () => {
  it('keeps the learner on their own voice and gives the other part a man when theirs is a woman', () => {
    expect(Object.fromEntries(speakerVoices(['A', 'B'], 'A', 3))).toEqual({ A: 3, B: 11 });
    expect(Object.fromEntries(speakerVoices(['A', 'B'], 'B', 3))).toEqual({ B: 3, A: 11 });
  });

  it('starts the others with a woman when the learner speaks as a man, then alternates', () => {
    expect(Object.fromEntries(speakerVoices(['A', 'B', 'C', 'D'], 'A', 13))).toEqual({
      A: 13,
      B: 3,
      C: 11,
      D: 2,
    });
  });

  it('never gives another part the learner’s character in another style', () => {
    // 2 is 四国めたん, and so are 0 and 36: the next woman is ずんだもん (3).
    const voices = speakerVoices(['A', 'B', 'C'], 'A', 2);
    expect(voices.get('B')).toBe(11);
    expect(voices.get('C')).toBe(3);
    expect([...voices.values()]).not.toContain(0);
  });

  it('is the same every time, and gives a script with no chosen part voices in order', () => {
    expect(speakerVoices(['店員', '客'], null, 3)).toEqual(speakerVoices(['店員', '客'], null, 3));
    expect(Object.fromEntries(speakerVoices(['店員', '客'], null, 3))).toEqual({ 店員: 11, 客: 2 });
  });

  it('falls back to the learner’s voice once every character speaks', () => {
    const many = Array.from({ length: 12 }, (_, i) => `P${i}`);
    const voices = speakerVoices(many, 'P0', 3);
    // Ten characters: the learner's, then nine for P1 to P9.
    expect(new Set([...voices.values()].filter((v) => v !== 3)).size).toBe(9);
    expect([voices.get('P10'), voices.get('P11')]).toEqual([3, 3]);
  });
});

describe('voices chosen per part (Kaiwa c)', () => {
  it('win over the voices given in order, and the others avoid their characters', () => {
    // B chose 青山龍星 (13): C, the next man in turn, cannot be him.
    const voices = speakerVoices(['A', 'B', 'C'], 'A', 3, { B: 13 });
    expect(voices.get('A')).toBe(3);
    expect(voices.get('B')).toBe(13);
    expect(voices.get('C')).not.toBe(13);
    expect(voices.get('C')).not.toBe(3);
  });

  it("win over Cài đặt for the learner's own part", () => {
    const voices = speakerVoices(['A', 'B'], 'A', 3, { A: 11 });
    expect(voices.get('A')).toBe(11);
    // The learner now speaks as a man, so B starts with a woman.
    expect(voices.get('B')).toBe(3);
  });
});

describe('readVoices and checkVoices', () => {
  it('keeps only parts the script still has and voices that exist', () => {
    expect(readVoices('{"A":11,"Z":3,"B":999}', ['A', 'B'])).toEqual({ A: 11 });
    expect(readVoices('not json', ['A'])).toEqual({});
    expect(readVoices(null, ['A'])).toEqual({});
  });

  it('names the part that is wrong', () => {
    expect(checkVoices({ A: 11 }, ['A', 'B'])).toBeNull();
    expect(checkVoices({ Z: 11 }, ['A', 'B'])).toBe('Kịch bản không có vai "Z".');
    expect(checkVoices({ A: 999 }, ['A'])).toBe('Giọng cho vai "A" không có trong danh sách.');
  });
});
