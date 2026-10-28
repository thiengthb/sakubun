import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildOpenJlptExamples,
  openJlptExample,
  openJlptExamples,
} from '@/lib/app/openjlpt-examples';
import { segmentsText, markSpans } from '@/lib/domain/sentence';
import type { ExamplesFile } from '@/lib/import/examples-data';
import type { OjSource } from '@/lib/import/openjlpt';

const read = (file: string) =>
  JSON.parse(readFileSync(path.join(process.cwd(), 'data/openjlpt', file), 'utf8'));

const SOURCE: OjSource = {
  version: 'x',
  commit: 'x',
  grammar: [
    {
      id: 'g:wa',
      expression: '〜は',
      level: 'N5',
      meaningEn: 'as for',
      formation: 'Noun + は',
      example: { ja: '私は学生です。', furigana: '{私|わたし}は{学生|がくせい}です。', en: 'x' },
    },
  ],
  vocab: [
    {
      id: 'v:au',
      expression: '会う',
      reading: 'あう',
      level: 'N5',
      meaningEn: 'to meet',
      example: { ja: '駅で友達に会った。', furigana: null, en: 'x' },
    },
    {
      id: 'v:au-n3',
      expression: '会う',
      reading: 'あう',
      level: 'N3',
      meaningEn: 'to meet',
      example: { ja: 'また会おう。', furigana: null, en: 'x' },
    },
    {
      id: 'v:ogamu',
      expression: '拝む',
      level: 'N3',
      meaningEn: 'to pray',
      example: { ja: '顔を拝ませてもらう。', furigana: null, en: 'x' },
    },
  ],
};

const FILE: ExamplesFile = {
  version: 1,
  entries: {
    'g:wa': { vi: 'Tôi là sinh viên.', span: ['は'], formationVi: 'Danh từ + は' },
    'v:au': { vi: 'Tôi đã gặp bạn ở nhà ga.', span: ['会'] },
    'v:au-n3': { vi: 'Hẹn gặp lại.', span: ['会'] },
    'v:ogamu': { skip: 'nghĩa bóng' },
  },
};

describe('buildOpenJlptExamples', () => {
  const map = buildOpenJlptExamples(SOURCE, FILE);

  it('gives the sentence with its translation, furigana, place and formation', () => {
    expect(openJlptExample(map, 'GRAMMAR', '〜は')).toEqual({
      skip: false,
      formationVi: 'Danh từ + は',
      example: {
        ja: '私は学生です。',
        vi: 'Tôi là sinh viên.',
        jaRuby: '私[わたし]は学生[がくせい]です。',
        spans: [{ start: 1, end: 2 }],
      },
    });
  });

  it('keeps the easier level of a word listed twice, and finds it by its NFKC form', () => {
    const au = openJlptExample(map, 'VOCAB', ' 会う ');
    expect(au?.skip === false && au.example?.vi).toBe('Tôi đã gặp bạn ở nhà ga.');
  });

  it('marks a sentence unfit to learn from, and knows nothing of other items', () => {
    expect(openJlptExample(map, 'VOCAB', '拝む')).toEqual({ skip: true });
    expect(openJlptExample(map, 'GRAMMAR', '会う')).toBeNull();
    expect(openJlptExample(map, 'VOCAB', '食べる')).toBeNull();
  });
});

describe('openJlptExamples on the committed data', () => {
  // Every translated entry reaches a card: the sentence, its translation, and a mark where the item
  // stands. Grows with each batch written into data/openjlpt/examples.json.
  it('turns every entry of examples.json into a marked, translated sentence', async () => {
    const source: OjSource = read('source.json');
    const file: ExamplesFile = read('examples.json');
    const map = await openJlptExamples();
    const byId = new Map(
      [
        ...source.grammar.map((e) => ['GRAMMAR', e] as const),
        ...source.vocab.map((e) => ['VOCAB', e] as const),
      ].map(([kind, e]) => [e.id, { kind, e }]),
    );
    // The same word at two levels keeps its first written entry, so a later one is never read.
    const shown = new Map<string, string>();
    for (const [id, { kind, e }] of byId) {
      const k = `${kind}\u0000${e.expression.normalize('NFKC').trim()}`;
      if (!shown.has(k) && file.entries[id] && e.example) shown.set(k, id);
    }
    const shownIds = new Set(shown.values());
    let checked = 0;
    for (const [id, data] of Object.entries(file.entries)) {
      if (!shownIds.has(id)) continue;
      const { kind, e } = byId.get(id)!;
      const found = openJlptExample(map, kind, e.expression);
      if (data.skip) {
        expect(found?.skip, id).toBe(true);
        continue;
      }
      expect(found?.skip, id).toBe(false);
      if (found?.skip !== false) continue;
      const { example } = found;
      expect(example?.ja, id).toBe(e.example?.ja);
      expect(example?.vi, id).toBe(data.vi);
      expect(example?.spans?.length, id).toBeGreaterThan(0);
      const segments = markSpans(example!.ja, example!.jaRuby, example!.spans!, 'target');
      expect(segmentsText(segments), id).toBe(example!.ja);
      expect(
        segments.some((s) => s.mark === 'target'),
        id,
      ).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(shownIds.size * 0.9);
  });
});
