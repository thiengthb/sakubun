import { describe, expect, it } from 'vitest';
import { speakerVoices } from '@/lib/kaiwa/voices';

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
