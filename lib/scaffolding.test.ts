// DB harness for DECLARED SCAFFOLDING (plan 2026-07-26-natural-generation, Phase 3.1/3.3).
//
// The two failures this feature exists to make visible are both SILENT today: a pattern the learner
// has never met teaching itself inside an exercise about something else, and scaffolding harder than
// the level being drilled — a rule the protocol has always stated and nothing has ever checked. A
// silent failure needs a test that fails loudly, so the classification is asserted against real rows
// rather than trusted to a description.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-scaffold-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Scaffolding = typeof import('@/lib/scaffolding');
type Db = typeof import('@/lib/db');

let S: Scaffolding;
let prisma: Db['prisma'];

let seq = 0;
async function freshUser(): Promise<string> {
  const id = `sc${seq++}`;
  await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
  return id;
}

async function addGrammar(
  expression: string,
  level = 'N3',
  visibility = 'private',
): Promise<string> {
  const row = await prisma.item.create({
    data: { kind: 'GRAMMAR', expression, meaningVi: 'nghĩa', level, visibility },
  });
  return row.id;
}

beforeAll(async () => {
  S = await import('@/lib/scaffolding');
  ({ prisma } = await import('@/lib/db'));
});

describe('classification against the learner OWN library', () => {
  it('reports a pattern they own as known, with its id so an offer can target it', async () => {
    const user = await freshUser();
    const itemId = await addGrammar(user, '〜ておく');
    const [p] = await S.classifyExtraPatterns(user, ['〜ておく'], 'N3');
    expect(p.status).toBe('known');
    expect(p.itemId).toBe(itemId);
    expect(p.level).toBe('N3');
  });

  it('matches through the SHARED normaliser, so a quoted pattern is not reported as new', async () => {
    // The exact bug this guards: the library stores 〜ておく, a model quotes it back as 「〜ておく」,
    // a raw match misses, the turn reports it as brand new and offers to ADD a duplicate. Found by
    // driving the real tool on 2026-07-27 in the sibling feature.
    const user = await freshUser();
    await addGrammar(user, '〜ておく');
    const [p] = await S.classifyExtraPatterns(user, ['「〜ておく」'], 'N3');
    expect(p.status).toBe('known');
    // The expression is echoed EXACTLY as declared, so the offer Claude relays matches what it said.
    expect(p.expression).toBe('「〜ておく」');
  });

  it('reports a pattern nobody has as newToLearner, with no level to guess at', async () => {
    const user = await freshUser();
    const [p] = await S.classifyExtraPatterns(user, ['〜つつ'], 'N3');
    expect(p.status).toBe('newToLearner');
    expect(p.level).toBeNull();
    expect(p.aboveDrilledLevel).toBe(false);
  });

  it('does not mistake a near-miss LIKE hit for a match', async () => {
    // `listItems` searches with LIKE, so a substring can return rows that are not the pattern. The
    // decision is made on the normalised key; "the search returned something" is not evidence.
    const user = await freshUser();
    await addGrammar(user, '〜ておくべきだ');
    const [p] = await S.classifyExtraPatterns(user, ['〜ておく'], 'N3');
    expect(p.status).toBe('newToLearner');
  });
});

describe('classification against the SHARED library', () => {
  it('finds a pattern another member published and hands back its source id', async () => {
    const learner = await freshUser();
    const sharer = await freshUser();
    const sourceItemId = await addGrammar(sharer, '〜ながらも', 'N2', 'public');
    const [p] = await S.classifyExtraPatterns(learner, ['〜ながらも'], 'N2');
    expect(p.status).toBe('availableInSharedLibrary');
    expect(p.itemId).toBe(sourceItemId);
  });

  it('prefers THEIR OWN copy over a public one — no fork offer for something they have', async () => {
    const learner = await freshUser();
    const sharer = await freshUser();
    await addGrammar(sharer, '〜ながらも', 'N2', 'public');
    await addGrammar(learner, '〜ながらも', 'N2');
    const [p] = await S.classifyExtraPatterns(learner, ['〜ながらも'], 'N2');
    expect(p.status).toBe('known');
  });
});

describe('the level rule that was never enforceable', () => {
  it('flags scaffolding HARDER than the level being drilled', async () => {
    const user = await freshUser();
    await addGrammar(user, '〜ざるを得ない', 'N2');
    const [p] = await S.classifyExtraPatterns(user, ['〜ざるを得ない'], 'N4');
    expect(p.aboveDrilledLevel).toBe(true);
  });

  it('does NOT flag easier or equal scaffolding — that is what scaffolding IS', async () => {
    const user = await freshUser();
    await addGrammar(user, '〜てから', 'N5');
    await addGrammar(user, '〜そうだ', 'N4');
    const picks = await S.classifyExtraPatterns(user, ['〜てから', '〜そうだ'], 'N4');
    expect(picks.every((p) => p.aboveDrilledLevel)).toBe(false);
  });

  it('makes no level claim when the pattern is unknown', async () => {
    const user = await freshUser();
    const [p] = await S.classifyExtraPatterns(user, ['〜んばかりに'], 'N5');
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
    const user = await freshUser();
    const a = await addGrammar(user, '〜てから', 'N5');
    const b = await addGrammar(user, '〜ざるを得ない', 'N2');
    expect(await S.drilledLevelOf(user, [a, b])).toBe('N2');
  });

  it('ignores an id belonging to someone else', async () => {
    // A stranger's N1 item must not widen what counts as "already being drilled" — that would turn
    // the level rule off for anyone who could guess an id.
    const user = await freshUser();
    const stranger = await freshUser();
    const mine = await addGrammar(user, '〜てから', 'N5');
    const theirs = await addGrammar(stranger, '〜んがため', 'N1');
    expect(await S.drilledLevelOf(user, [mine, theirs])).toBe('N5');
  });

  it('is null for an empty batch', async () => {
    const user = await freshUser();
    expect(await S.drilledLevelOf(user, [])).toBeNull();
  });
});

describe('bounds', () => {
  it('drops blanks and caps the list', async () => {
    const user = await freshUser();
    const many = Array.from({ length: S.MAX_EXTRA_PATTERNS + 3 }, (_, i) => `〜pattern${i}`);
    const out = await S.classifyExtraPatterns(user, ['   ', ...many], 'N3');
    expect(out).toHaveLength(S.MAX_EXTRA_PATTERNS);
  });

  it('returns nothing for nothing — a quiet turn stays quiet', async () => {
    const user = await freshUser();
    expect(await S.classifyExtraPatterns(user, [], 'N3')).toEqual([]);
  });
});

describe('persistence — the row is the record of what the learner was exposed to', () => {
  it('stageSentence stores the declared patterns as JSON', async () => {
    const P = await import('@/lib/practice');
    const user = await freshUser();
    const itemId = await addGrammar(user, '〜ざるを得ない', 'N2');
    const { sentenceId } = await P.stageSentence(user, {
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
    const user = await freshUser();
    const itemId = await addGrammar(user, '〜ざるを得ない', 'N2');
    const { sentenceId } = await P.stageSentence(user, {
      direction: 'VI_JA',
      sourceText: 'nguồn',
      suggested: '日本語',
      items: [{ itemId, role: 'TARGET' }],
    });
    const row = await prisma.sentence.findFirst({ where: { id: sentenceId } });
    expect(row!.extraPatterns).toBeNull();
  });
});
