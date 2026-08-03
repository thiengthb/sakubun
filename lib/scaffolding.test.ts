// DB harness for DECLARED SCAFFOLDING (plan 2026-07-26-natural-generation, Phase 3.1/3.3).
//
// The two failures this feature exists to make visible are both SILENT today: a pattern the learner
// has never met teaching itself inside an exercise about something else, and scaffolding harder than
// the level being drilled — a rule the protocol has always stated and nothing has ever checked. A
// silent failure needs a test that fails loudly, so the classification is asserted against real rows
// rather than trusted to a description.

import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/test-db';

createTestDb('sakubun-scaffold-');

type Scaffolding = typeof import('@/lib/scaffolding');
type Db = typeof import('@/lib/db');

let S: Scaffolding;
let prisma: Db['prisma'];

/**
 * Per-case isolation. Each test used to take a `freshUser()` and lean on the tenancy filter to keep its
 * rows apart; with one learner and no tenant column, isolation has to come from an empty DB instead.
 * Children before parents (SQLite FK).
 */
async function resetData(): Promise<void> {
  await prisma.reviewLog.deleteMany({});
  await prisma.sentence.deleteMany({});
  await prisma.srsState.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.calibrationProposal.deleteMany({});
  await prisma.learnerNote.deleteMany({});
  await prisma.learnerAbility.deleteMany({});
  await prisma.settings.deleteMany({});
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
  S = await import('@/lib/scaffolding');
  ({ prisma } = await import('@/lib/db'));
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
    // The exact bug this guards: the library stores 〜ておく, a model quotes it back as 「〜ておく」,
    // a raw match misses, the turn reports it as brand new and offers to ADD a duplicate. Found by
    // driving the real tool on 2026-07-27 in the sibling feature.
    await resetData();
    await addGrammar('〜ておく');
    const [p] = await S.classifyExtraPatterns(['「〜ておく」'], 'N3');
    expect(p.status).toBe('known');
    // The expression is echoed EXACTLY as declared, so the offer Claude relays matches what it said.
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
    // `listItems` searches with LIKE, so a substring can return rows that are not the pattern. The
    // decision is made on the normalised key; "the search returned something" is not evidence.
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
    const P = await import('@/lib/practice');
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
    const P = await import('@/lib/practice');
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
