import { describe, expect, it } from 'vitest';
import { rowParts, speakerPrefix } from '@/lib/kaiwa/syntax';

const show = (row: string) => rowParts(row).map((p) => [p.kind, row.slice(p.from, p.to)]);

describe('rowParts', () => {
  it('marks the speaker, the bar, the Vietnamese and the readings of a dialogue row', () => {
    expect(show('A: 二人[ふたり]です。 | Hai người.')).toEqual([
      ['speaker', 'A: '],
      ['reading', '[ふたり]'],
      ['bar', '|'],
      ['translation', ' Hai người.'],
    ]);
    expect(show('田中：はい｜Vâng')).toEqual([
      ['speaker', '田中：'],
      ['bar', '｜'],
      ['translation', 'Vâng'],
    ]);
  });

  it('leaves a row with no speaker or no bar as Japanese', () => {
    expect(show('店の中は静かだった。')).toEqual([]);
    expect(show('10:30に会いましょう。 | Gặp lúc 10:30.')).toEqual([
      ['bar', '|'],
      ['translation', ' Gặp lúc 10:30.'],
    ]);
  });

  it('reads the older Markdown style as parseScript does', () => {
    expect(show('**C:** 何ですか。')).toEqual([['speaker', '**C:** ']]);
    expect(show('**Tiếng Việt:** Cái gì vậy?')).toEqual([
      ['translation', '**Tiếng Việt:** Cái gì vậy?'],
    ]);
  });

  it('never colours a reading in the Vietnamese', () => {
    expect(show('A: はい | [cười]')).toEqual([
      ['speaker', 'A: '],
      ['bar', '|'],
      ['translation', ' [cười]'],
    ]);
  });
});

describe('speakerPrefix', () => {
  it('is the label being typed at the start of a row, and null once past it', () => {
    expect(speakerPrefix('')).toBe('');
    expect(speakerPrefix('田')).toBe('田');
    expect(speakerPrefix('A: こ')).toBeNull();
    expect(speakerPrefix('A ')).toBeNull();
  });
});
