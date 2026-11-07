import { describe, expect, it } from 'vitest';
import { parseFurigana } from '@/lib/japanese/furigana';
import {
  charMorae,
  karaokeLit,
  moraCount,
  moraStarts,
  type AudioQuery,
} from '@/lib/japanese/karaoke';

const mora = (vowel: number, consonant: number | null = null) => ({
  consonant_length: consonant,
  vowel_length: vowel,
});

describe('moraStarts', () => {
  it('places each mora by its length, silences and pauses included', () => {
    // 0.1 silence, ア 0.1, コ 0.1+0.1, pause 0.2, ネ 0.2, 0.2 silence: 1.0 in all.
    const q: AudioQuery = {
      prePhonemeLength: 0.1,
      postPhonemeLength: 0.2,
      accent_phrases: [
        { moras: [mora(0.1), mora(0.1, 0.1)], pause_mora: mora(0.2) },
        { moras: [mora(0.2)] },
      ],
    };
    expect(moraStarts(q)!.map((s) => +s.toFixed(3))).toEqual([0.1, 0.2, 0.6]);
    expect(moraStarts({ ...q, pauseLength: 0 })!.map((s) => +s.toFixed(3))).toEqual([
      0.125, 0.25, 0.5,
    ]);
  });

  it('gives nothing for an empty reading', () => {
    expect(moraStarts({ accent_phrases: [] })).toBeNull();
    expect(moraStarts({})).toBeNull();
  });
});

describe('charMorae', () => {
  it('counts small kana with the one before, and っ ん ー on their own', () => {
    expect(moraCount('きょう')).toBe(2);
    expect(moraCount('ちょっと')).toBe(3);
    expect(moraCount('コーヒー')).toBe(4);
    expect(moraCount('しんぶん')).toBe(4);
  });

  it('shares a kanji run’s reading out, first characters longest', () => {
    expect(charMorae(parseFurigana('料理[りょうり]を'))).toEqual([2, 1, 1]);
    expect(charMorae(parseFurigana('今日[きょう]は、'))).toEqual([1, 1, 1, 0]);
    expect(charMorae(parseFurigana('ちょっと'))).toEqual([1, 0, 1, 1]);
  });

  it('gives up on what it cannot read: kanji without furigana, digits, letters', () => {
    expect(charMorae(parseFurigana('料理を'))).toBeNull();
    expect(charMorae([{ text: '3時' }])).toBeNull();
    expect(charMorae([{ text: 'OKです' }])).toBeNull();
  });
});

describe('karaokeLit', () => {
  // 料理[りょうり]を。: りょ う り を, four morae evenly spread after a short silence.
  const segments = parseFurigana('料理[りょうり]を。');
  const starts = [0.1, 0.3, 0.5, 0.7];

  it('lights each character as its first mora starts', () => {
    const lit = karaokeLit(starts, segments)!;
    expect(lit(0)).toBe(0);
    expect(lit(0.05)).toBe(0); // the silence before the first mora
    expect(lit(0.1)).toBe(1); // 料 (りょ, う)
    expect(lit(0.4)).toBe(1); // still う, part of 料
    expect(lit(0.5)).toBe(2); // 理 (り)
    expect(lit(0.7)).toBe(4); // を, and 。 with it
    expect(lit(1)).toBe(4);
  });

  it('is null when the line and the reading disagree on the morae', () => {
    expect(karaokeLit([0.1, 0.3, 0.5], segments)).toBeNull();
    expect(karaokeLit(starts, parseFurigana('料理を。'))).toBeNull();
  });
});
