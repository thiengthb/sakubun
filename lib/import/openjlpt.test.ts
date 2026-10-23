import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import { buildImport, exampleFromNotes, spellHanviet, type OjSource } from '@/lib/import/openjlpt';

createTestDb('sakubun-openjlpt-');

const NOW = new Date('2026-10-10T00:00:00Z');
const SRC: OjSource = {
  version: '0.3.0',
  commit: 'x',
  grammar: [
    {
      id: 'g:wake',
      expression: '〜わけだ',
      level: 'N3',
      meaningEn: 'no wonder',
      formation: 'V + わけだ',
      example: { ja: '道理で寒いわけだ。', furigana: null, en: 'No wonder (it is) cold.' },
    },
    { id: 'g:novi', expression: '〜ものの', level: 'N2', meaningEn: 'although' },
  ],
  vocab: [
    { id: 'v:1', expression: '確認', reading: 'かくにん', level: 'N3', meaningEn: 'confirmation' },
    { id: 'v:2', expression: '確認', reading: 'かくにん', level: 'N4', meaningEn: 'check' },
    { id: 'v:3', expression: 'あらゆる', reading: 'あらゆる', level: 'N3', meaningEn: 'all' },
    { id: 'v:4', expression: '峠', reading: 'とうげ', level: 'N1', meaningEn: 'mountain pass' },
  ],
};
const VI = {
  'g:wake': { meaningVi: 'thảo nào; hèn chi' },
  'v:1': { meaningVi: 'xác nhận' },
  'v:2': { meaningVi: 'kiểm tra' },
  'v:3': { meaningVi: 'mọi; tất cả' },
  'v:4': { meaningVi: 'đèo' },
};
const HV = {
  確: { reading: 'xác', source: 'agree' },
  認: { reading: 'nhận', source: 'agree' },
  峠: { reading: null, source: 'invalid' },
  児: { reading: 'nhĩ', source: 'llm-only' },
};

describe('spellHanviet', () => {
  it('ghép âm từng chữ kanji, viết hoa; thiếu một chữ thì bỏ trống cả từ', () => {
    expect(spellHanviet('確認する', HV)).toBe('XÁC NHẬN');
    expect(spellHanviet('峠', HV)).toBeNull();
    expect(spellHanviet('あらゆる', HV)).toBeNull();
    expect(spellHanviet('確々', HV)).toBe('XÁC XÁC');
    // Only dictionary-confirmed readings: a model-only guess leaves the whole word blank.
    expect(spellHanviet('児童', HV)).toBeNull();
  });
});

describe('buildImport', () => {
  const r = buildImport(SRC, VI, HV, NOW);

  it('ghi câu ví dụ vào notes và đọc lại được nguyên văn', () => {
    const wake = r.items.find((i) => i.expression === '〜わけだ')!;
    expect(exampleFromNotes(wake.notes)).toEqual({
      ja: '道理で寒いわけだ。',
      en: 'No wonder (it is) cold.',
    });
    expect(exampleFromNotes(r.items.find((i) => i.expression === '峠')!.notes)).toBeNull();
    expect(exampleFromNotes('Ví dụ: 雨が降る。')).toEqual({ ja: '雨が降る。', en: null });
    expect(exampleFromNotes(null)).toBeNull();
  });

  it('bỏ qua mục chưa có nghĩa tiếng Việt', () => {
    expect(r.skipped.map((s) => s.id)).toEqual(['g:novi']);
  });

  it('gộp từ trùng ở hai cấp: giữ cấp dễ hơn, nối thêm nghĩa', () => {
    const kakunin = r.items.filter((i) => i.expression === '確認');
    expect(kakunin).toHaveLength(1);
    expect(kakunin[0]).toMatchObject({
      level: 'N4',
      meaningVi: 'xác nhận; kiểm tra',
      hanviet: 'XÁC NHẬN',
    });
    expect(r.merged).toBe(1);
  });

  it('từ thuần kana không có reading/hanviet; mỗi mục có lịch FSRS mới, nguồn và tag', () => {
    const arayuru = r.items.find((i) => i.expression === 'あらゆる')!;
    expect(arayuru.reading).toBeNull();
    expect(arayuru.hanviet).toBeNull();
    expect(r.srsStates).toHaveLength(r.items.length);
    expect(r.srsStates[0]).toMatchObject({ state: 0, reps: 0, due: NOW.toISOString() });
    expect(JSON.parse(r.items[0].tags)).toEqual(['openjlpt', 'jlpt-n3']);
    expect(r.items.every((i) => i.source === 'OPENJLPT')).toBe(true);
  });

  it('id ổn định giữa các lần build', () => {
    expect(buildImport(SRC, VI, HV, NOW).items.map((i) => i.id)).toEqual(r.items.map((i) => i.id));
  });
});

describe('nạp qua importer tài khoản có sẵn', () => {
  type Db = typeof import('@/lib/db/db');
  let prisma: Db['prisma'];
  beforeAll(async () => {
    ({ prisma } = await import('@/lib/db/db'));
  });
  beforeEach(async () => {
    await prisma.srsState.deleteMany({});
    await prisma.item.deleteMany({});
  });

  it('dry-run không ghi; nạp thật tạo mục + lịch; mục người học đã có không bị đè', async () => {
    const { importAccountData } = await import('@/lib/transfer/import');
    const { parseAccountBackup } = await import('@/lib/transfer/schema');
    await prisma.item.create({
      data: { kind: 'VOCAB', expression: 'あらゆる', meaningVi: 'nghĩa của tôi', source: 'MANUAL' },
    });
    const built = buildImport(SRC, VI, HV, NOW);
    const parsed = parseAccountBackup({ items: built.items, srsStates: built.srsStates });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await importAccountData(parsed.data, { dryRun: true });
    expect(await prisma.item.count()).toBe(1);

    await importAccountData(parsed.data, { dryRun: false });
    expect(await prisma.item.count()).toBe(built.items.length); // 3 new + the learner's own あらゆる
    expect((await prisma.item.findFirst({ where: { expression: 'あらゆる' } }))?.meaningVi).toBe(
      'nghĩa của tôi',
    );
    const kakunin = await prisma.item.findFirst({
      where: { expression: '確認' },
      include: { srs: true },
    });
    expect(kakunin?.source).toBe('OPENJLPT');
    expect(kakunin?.srs?.state).toBe(0);
  });
});
