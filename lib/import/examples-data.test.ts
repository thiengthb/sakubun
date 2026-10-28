import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkEntry,
  checkExamples,
  entriesWithExample,
  plainFromFurigana,
  resolveSpans,
  rubyFromFurigana,
} from '@/lib/import/examples-data';
import type { OjEntry, OjSource } from '@/lib/import/openjlpt';

const DIR = path.join(process.cwd(), 'data/openjlpt');
const read = (file: string) => JSON.parse(readFileSync(path.join(DIR, file), 'utf8'));

const SHIKA: OjEntry = {
  id: 'g:shika-nai',
  expression: '〜しか〜ない',
  level: 'N4',
  meaningEn: 'only',
  formation: 'Noun + しか + Verb-ない',
  example: { ja: '財布に五百円しかない。', furigana: null, en: 'I only have 500 yen.' },
};
const WA: OjEntry = {
  id: 'g:wa',
  expression: '〜は',
  level: 'N5',
  meaningEn: 'as for',
  formation: 'Noun + は',
  example: { ja: '私はこれは好きです。', furigana: null, en: 'I like this.' },
};
const AU: OjEntry = {
  id: 'v:au',
  expression: '会う',
  reading: 'あう',
  level: 'N5',
  meaningEn: 'to meet',
  example: { ja: '駅で友達に会った。', furigana: null, en: 'I met a friend at the station.' },
};
const SOURCE: OjSource = {
  version: 'x',
  commit: 'x',
  grammar: [
    SHIKA,
    WA,
    { id: 'g:none', expression: '〜ものの', level: 'N2', meaningEn: 'although' },
  ],
  vocab: [AU],
};

describe('furigana', () => {
  it('turns OpenJLPT furigana into the app ruby markup', () => {
    expect(rubyFromFurigana('{毎朝|まいあさ}パンを{食|た}べます。')).toBe(
      '毎朝[まいあさ]パンを食[た]べます。',
    );
    expect(plainFromFurigana('{毎朝|まいあさ}パンを{食|た}べます。')).toBe('毎朝パンを食べます。');
  });

  it('gives back every sentence of the real source', () => {
    const source: OjSource = read('source.json');
    const withFurigana = entriesWithExample(source).filter((e) => e.example?.furigana);
    expect(withFurigana.length).toBeGreaterThan(5000);
    for (const e of withFurigana)
      expect(plainFromFurigana(e.example!.furigana!)).toBe(e.example!.ja);
  });
});

describe('resolveSpans', () => {
  it('places one piece, or two for a split pattern, left to right', () => {
    expect(resolveSpans('駅で友達に会った。', ['会'])).toEqual({
      ok: true,
      spans: [{ start: 5, end: 6 }],
    });
    expect(resolveSpans('財布に五百円しかない。', ['しか', 'ない'])).toEqual({
      ok: true,
      spans: [
        { start: 6, end: 8 },
        { start: 8, end: 10 },
      ],
    });
  });

  it('refuses text that is missing or ambiguous, and asks for offsets instead', () => {
    expect(resolveSpans('私は学生です。', ['が'])).toMatchObject({ ok: false });
    const twice = resolveSpans('私はこれは好きです。', ['は']);
    expect(twice.ok).toBe(false);
    expect(!twice.ok && twice.error).toContain('ghi [đầu, cuối]');
    expect(resolveSpans('私はこれは好きです。', [[1, 2]])).toEqual({
      ok: true,
      spans: [{ start: 1, end: 2 }],
    });
  });

  it('refuses offsets outside the sentence or behind the previous piece', () => {
    expect(resolveSpans('私は学生です。', [[5, 99]]).ok).toBe(false);
    expect(resolveSpans('私は学生です。', ['学生', [0, 1]]).ok).toBe(false);
    expect(resolveSpans('私は学生です。', []).ok).toBe(false);
  });
});

describe('checkEntry', () => {
  it('accepts a complete grammar entry and a complete vocab entry', () => {
    const shika = {
      vi: 'Trong ví chỉ có năm trăm yên.',
      span: ['しか', 'ない'],
      formationVi: 'Danh từ + しか + Động từ thể ない',
    };
    expect(checkEntry(SHIKA, shika)).toEqual([]);
    expect(checkEntry(AU, { vi: 'Tôi đã gặp bạn ở nhà ga.', span: ['会'] })).toEqual([]);
  });

  it('names what is missing or wrong', () => {
    expect(checkEntry(AU, {})).toEqual(['thiếu vi', 'thiếu span']);
    expect(checkEntry(SHIKA, { vi: 'x', span: ['しか'] })).toEqual([
      'thiếu formationVi (mục có formation)',
    ]);
    expect(checkEntry(AU, { vi: '会った', span: ['会'] })).toEqual(['vi còn chữ Nhật']);
    expect(checkEntry(AU, { vi: 'x', span: ['会'], formationVi: 'y' })).toEqual([
      'formationVi chỉ dành cho ngữ pháp',
    ]);
    expect(checkEntry(AU, { vi: 'x', span: ['会'], note: 'y' } as never)).toEqual([
      'khoá lạ "note"',
    ]);
  });

  it('lets a skipped sentence go without translation or span, but not without a reason', () => {
    expect(checkEntry(SHIKA, { skip: 'câu nghĩa bóng' })).toEqual([]);
    expect(checkEntry(SHIKA, { skip: ' ' })).toContain('skip phải là lý do (chuỗi không rỗng)');
  });
});

describe('checkExamples', () => {
  it('counts done, skipped and missing, and rejects ids without an example', () => {
    const report = checkExamples(SOURCE, {
      version: 1,
      entries: {
        'g:shika-nai': { skip: 'x' },
        'v:au': { vi: 'Tôi đã gặp bạn.', span: ['会'] },
        'g:none': { vi: 'x', span: ['x'] },
      },
    });
    expect(report).toMatchObject({ done: 2, skipped: 1, missing: 1, total: 3 });
    expect(report.errors).toEqual(['g:none: không có mục nào có câu ví dụ mang id này']);
  });

  it('rejects a file of the wrong shape', () => {
    expect(checkExamples(SOURCE, { entries: {} }).errors).toHaveLength(1);
  });

  // CI keeps every batch written outside the app honest.
  it('passes on the committed data/openjlpt/examples.json', () => {
    const report = checkExamples(read('source.json'), read('examples.json'));
    expect(report.errors).toEqual([]);
  });
});
