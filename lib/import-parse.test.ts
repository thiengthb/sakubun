import { describe, expect, it } from 'vitest';
import { condenseMeaning, maziiEntry, parseImportText } from '@/lib/import-parse';

const MAZII_MEAN =
  'con người; nhân loại; người; người khác; người ta; tôi; người ta; vợ gọi chồng; người; con người';

describe('condenseMeaning', () => {
  it('keeps the first 4 unique senses and marks truncation', () => {
    expect(condenseMeaning(MAZII_MEAN)).toBe('con người; nhân loại; người; người khác…');
  });

  it('returns short meanings untouched', () => {
    expect(condenseMeaning('khó')).toBe('khó');
    expect(condenseMeaning('học; việc học')).toBe('học; việc học');
  });
});

describe('maziiEntry', () => {
  it('maps the 4 Mazii columns', () => {
    const entry = maziiEntry('人', 'と ひと にん たり り じん びと', MAZII_MEAN, 'ghi chú N3');
    expect(entry).toMatchObject({
      expression: '人',
      reading: 'と ひと にん たり り じん びと',
      level: 'N3',
      notes: 'ghi chú N3',
    });
    expect(entry?.meaningVi.startsWith('con người; nhân loại')).toBe(true);
  });

  it('returns null without word or meaning', () => {
    expect(maziiEntry('', 'よみ', 'nghĩa')).toBeNull();
    expect(maziiEntry('人', '', '')).toBeNull();
  });
});

describe('parseImportText — Mazii table paste (Excel copy)', () => {
  it('parses tab-separated rows and skips the header', () => {
    const text = [
      'word\tphonetic\tmean\tcomment',
      `人\tと ひと にん たり り じん びと\t${MAZII_MEAN}\t`,
      '勉強\tべんきょう\thọc; việc học\tN5 cơ bản',
    ].join('\n');
    const result = parseImportText(text);
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].expression).toBe('人');
    expect(result.entries[1]).toMatchObject({ expression: '勉強', level: 'N5' });
  });

  it('reports a table row missing its meaning', () => {
    const result = parseImportText('人\tひと\t\t');
    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});

describe('parseImportText — free-form lines', () => {
  it('parses "expression (reading) : meaning Nx"', () => {
    const result = parseImportText('勉強 (べんきょう): học N5\n〜ばかりに: chỉ vì… N2');
    expect(result.entries).toEqual([
      expect.objectContaining({
        expression: '勉強',
        reading: 'べんきょう',
        meaningVi: 'học',
        level: 'N5',
      }),
      expect.objectContaining({ expression: '〜ばかりに', level: 'N2' }),
    ]);
  });

  it('flags lines without a separator', () => {
    const result = parseImportText('câu này không có phân cách');
    expect(result.errors).toHaveLength(1);
  });
});
