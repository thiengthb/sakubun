import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-import-');

type Preview = typeof import('@/lib/transfer/preview');
type Db = typeof import('@/lib/db/db');

let P: Preview;
let prisma: Db['prisma'];

async function resetData(): Promise<void> {
  await resetLearningData(prisma);
}

async function addItem(
  expression: string,
  over: { kind?: string; suspended?: boolean; enrichment?: string } = {},
): Promise<string> {
  const row = await prisma.item.create({
    data: {
      kind: over.kind ?? 'GRAMMAR',
      expression,
      meaningVi: 'nghĩa',
      level: 'N3',
      suspended: over.suspended ?? false,
      enrichment: over.enrichment ?? null,
    },
  });
  return row.id;
}

const candidate = (expression: string, kind: 'GRAMMAR' | 'VOCAB' = 'GRAMMAR') => ({
  kind,
  expression,
  meaningVi: 'nghĩa từ tài liệu',
});

beforeAll(async () => {
  P = await import('@/lib/transfer/preview');
  ({ prisma } = await import('@/lib/db/db'));
});

describe('the normaliser is what stands between a paste and a duplicated library', () => {
  it.each([
    ['「〜わけにはいかない」', 'quoted with corner brackets'],
    ['～わけにはいかない', 'full-width tilde instead of the wave dash'],
    ['わけにはいかない', 'no attachment mark at all'],
    ['  〜わけにはいかない  ', 'surrounding whitespace'],
  ])('classifies %s (%s) as a duplicate, not new', async (pasted) => {
    await resetData();
    const itemId = await addItem('〜わけにはいかない');
    const preview = await P.previewImport([candidate(pasted)]);
    expect(preview.counts).toEqual({ new: 0, duplicate: 1, ambiguous: 0 });
    expect(preview.duplicate[0].itemId).toBe(itemId);
    expect(preview.duplicate[0].stored).toBe('〜わけにはいかない');
    expect(preview.duplicate[0].expression).toBe(pasted);
  });

  it('folds HALF-WIDTH katakana onto the stored word (this is what NFKC is actually for)', async () => {
    await resetData();
    const itemId = await addItem('コーヒー', { kind: 'VOCAB' });
    const preview = await P.previewImport([candidate('ｺｰﾋｰ', 'VOCAB')]);
    expect(preview.counts).toEqual({ new: 0, duplicate: 1, ambiguous: 0 });
    expect(preview.duplicate[0].itemId).toBe(itemId);
  });

  it('does NOT fold katakana onto hiragana — a documented limit, not an oversight', async () => {
    await resetData();
    await addItem('わけにはいかない');
    const preview = await P.previewImport([candidate('ワケにはいかない')]);
    expect(preview.counts).toEqual({ new: 1, duplicate: 0, ambiguous: 0 });
  });

  it('lets a genuinely different pattern through as new', async () => {
    await resetData();
    await addItem('〜わけにはいかない');
    const preview = await P.previewImport([candidate('〜ざるを得ない')]);
    expect(preview.counts).toEqual({ new: 1, duplicate: 0, ambiguous: 0 });
    expect(preview.new[0].expression).toBe('〜ざるを得ない');
  });
});

describe('a SUSPENDED duplicate must not be reported as merely "already there"', () => {
  it('flags it so the offer becomes unsuspend, not add', async () => {
    await resetData();
    const itemId = await addItem('〜ばかりに', { suspended: true });
    const preview = await P.previewImport([candidate('ばかりに')]);
    expect(preview.duplicate).toHaveLength(1);
    expect(preview.duplicate[0]).toMatchObject({ itemId, suspended: true });
  });
});

describe('ambiguous means "a decision is needed", and the reason says which', () => {
  it('reports the same expression owned under the OTHER kind', async () => {
    await resetData();
    const itemId = await addItem('遠慮', { kind: 'VOCAB' });
    const preview = await P.previewImport([candidate('遠慮', 'GRAMMAR')]);
    expect(preview.counts).toEqual({ new: 0, duplicate: 0, ambiguous: 1 });
    expect(preview.ambiguous[0]).toMatchObject({
      reason: 'other-kind',
      itemId,
      storedKind: 'VOCAB',
    });
  });

  it('reports a repeat WITHIN the pasted material instead of silently collapsing it', async () => {
    await resetData();
    const preview = await P.previewImport([
      candidate('〜どころか'),
      candidate('「〜どころか」'), // the same pattern, quoted the second time
    ]);
    expect(preview.counts).toEqual({ new: 1, duplicate: 0, ambiguous: 1 });
    expect(preview.ambiguous[0].reason).toBe('repeated');
  });

});

describe('it writes nothing — that is the whole contract', () => {
  it('leaves the library byte-identical after a full preview', async () => {
    await resetData();
    await addItem('〜わけにはいかない');
    const before = await prisma.item.findMany({ where: {} });
    await P.previewImport([
      candidate('わけにはいかない'),
      candidate('〜ざるを得ない'),
      candidate('遠慮', 'VOCAB'),
    ]);
    const after = await prisma.item.findMany({ where: {} });
    expect(after).toEqual(before);
    expect(await prisma.srsState.count({ where: {} })).toBe(0);
  });
});
