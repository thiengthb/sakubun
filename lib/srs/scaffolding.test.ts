import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-scaffold-');

type Scaffolding = typeof import('@/lib/srs/scaffolding');
type Db = typeof import('@/lib/db/db');

let S: Scaffolding;
let prisma: Db['prisma'];

async function resetData(): Promise<void> {
  await resetLearningData(prisma);
}

async function addGrammar(
  expression: string,
  level = 'N3',
): Promise<string> {
  const row = await prisma.item.create({
    data: { kind: 'GRAMMAR', expression, meaningVi: 'nghĩa', level },
  });
  return row.id;
}

beforeAll(async () => {
  S = await import('@/lib/srs/scaffolding');
  ({ prisma } = await import('@/lib/db/db'));
});

describe('classification against the learner OWN library', () => {
  it('reports a pattern they own as known, with its id so an offer can target it', async () => {
    await resetData();
    const itemId = await addGrammar('〜ておく');
    const [p] = await S.classifyExtraPatterns(['〜ておく'], 'N3');
    expect(p.status).toBe('known');
    expect(p.itemId).toBe(itemId);
    expect(p.level).toBe('N3');
  });

  it('matches through the SHARED normaliser, so a quoted pattern is not reported as new', async () => {
    await resetData();
    await addGrammar('〜ておく');
    const [p] = await S.classifyExtraPatterns(['「〜ておく」'], 'N3');
    expect(p.status).toBe('known');
    expect(p.expression).toBe('「〜ておく」');
  });

  it('reports a pattern nobody has as newToLearner, with no level to guess at', async () => {
    await resetData();
    const [p] = await S.classifyExtraPatterns(['〜つつ'], 'N3');
    expect(p.status).toBe('newToLearner');
    expect(p.level).toBeNull();
    expect(p.aboveDrilledLevel).toBe(false);
  });

  it('does not mistake a near-miss LIKE hit for a match', async () => {
    await resetData();
    await addGrammar('〜ておくべきだ');
    const [p] = await S.classifyExtraPatterns(['〜ておく'], 'N3');
    expect(p.status).toBe('newToLearner');
  });
});

describe('the level rule that was never enforceable', () => {
  it('flags scaffolding HARDER than the level being drilled', async () => {
    await resetData();
    await addGrammar('〜ざるを得ない', 'N2');
    const [p] = await S.classifyExtraPatterns(['〜ざるを得ない'], 'N4');
    expect(p.aboveDrilledLevel).toBe(true);
  });

  it('does NOT flag easier or equal scaffolding — that is what scaffolding IS', async () => {
    await resetData();
    await addGrammar('〜てから', 'N5');
    await addGrammar('〜そうだ', 'N4');
    const picks = await S.classifyExtraPatterns(['〜てから', '〜そうだ'], 'N4');
    expect(picks.every((p) => p.aboveDrilledLevel)).toBe(false);
  });

  it('makes no level claim when the pattern is unknown', async () => {
    await resetData();
    const [p] = await S.classifyExtraPatterns(['〜んばかりに'], 'N5');
    expect(p.aboveDrilledLevel).toBe(false);
  });

  it('isAboveLevel refuses to guess on either side', () => {
    expect(S.isAboveLevel('N2', 'N4')).toBe(true);
    expect(S.isAboveLevel('N4', 'N2')).toBe(false);
    expect(S.isAboveLevel('N3', 'N3')).toBe(false);
    expect(S.isAboveLevel(null, 'N3')).toBe(false);
    expect(S.isAboveLevel('N3', null)).toBe(false);
  });
});

describe('drilledLevelOf — the HARDEST scheduled item, tenant-scoped', () => {
  it('takes the hardest level in the batch, not the first', async () => {
    await resetData();
    const a = await addGrammar('〜てから', 'N5');
    const b = await addGrammar('〜ざるを得ない', 'N2');
    expect(await S.drilledLevelOf([a, b])).toBe('N2');
  });

  it('is null for an empty batch', async () => {
    await resetData();
    expect(await S.drilledLevelOf([])).toBeNull();
  });
});

describe('bounds', () => {
  it('drops blanks and caps the list', async () => {
    await resetData();
    const many = Array.from({ length: S.MAX_EXTRA_PATTERNS + 3 }, (_, i) => `〜pattern${i}`);
    const out = await S.classifyExtraPatterns(['   ', ...many], 'N3');
    expect(out).toHaveLength(S.MAX_EXTRA_PATTERNS);
  });

  it('returns nothing for nothing — a quiet turn stays quiet', async () => {
    await resetData();
    expect(await S.classifyExtraPatterns([], 'N3')).toEqual([]);
  });
});

describe('persistence — the row is the record of what the learner was exposed to', () => {
  it('stageSentence stores the declared patterns as JSON', async () => {
    const P = await import('@/lib/library/practice');
    await resetData();
    const itemId = await addGrammar('〜ざるを得ない', 'N2');
    const { sentenceId } = await P.stageSentence({
      direction: 'VI_JA',
      sourceText: 'nguồn',
      suggested: '日本語',
      items: [{ itemId, role: 'TARGET' }],
      extraPatterns: ['〜ておく', '〜ながら'],
    });
    const row = await prisma.sentence.findFirst({ where: { id: sentenceId } });
    expect(JSON.parse(row!.extraPatterns!)).toEqual(['〜ておく', '〜ながら']);
  });

  it('stores null when the sentence declared none, so absent reads as absent', async () => {
    const P = await import('@/lib/library/practice');
    await resetData();
    const itemId = await addGrammar('〜ざるを得ない', 'N2');
    const { sentenceId } = await P.stageSentence({
      direction: 'VI_JA',
      sourceText: 'nguồn',
      suggested: '日本語',
      items: [{ itemId, role: 'TARGET' }],
    });
    const row = await prisma.sentence.findFirst({ where: { id: sentenceId } });
    expect(row!.extraPatterns).toBeNull();
  });
});
