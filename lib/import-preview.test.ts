// DB harness for the paste-anything dry run (plan step 6.1).
//
// The headline property is the one the plan called out by name: tilde / wave-dash / quote / NFKC
// variants of a pattern the learner ALREADY owns must classify as `duplicate`, never as `new`. This
// path adds in BULK, so a normalisation miss here does not produce one stray row — it produces a
// library with two of everything the source material happened to quote.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-import-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Preview = typeof import('@/lib/import-preview');
type Db = typeof import('@/lib/db');

let P: Preview;
let prisma: Db['prisma'];

let seq = 0;
async function freshUser(): Promise<string> {
  const id = `i${seq++}`;
  await prisma.user.create({ data: { id, name: `user ${id}`, email: `${id}@example.test` } });
  return id;
}

async function addItem(
  expression: string,
  over: { kind?: string; suspended?: boolean; visibility?: string; enrichment?: string } = {},
): Promise<string> {
  const row = await prisma.item.create({
    data: {
      kind: over.kind ?? 'GRAMMAR',
      expression,
      meaningVi: 'nghĩa',
      level: 'N3',
      suspended: over.suspended ?? false,
      visibility: over.visibility ?? 'private',
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

/** A card that passes `enrichmentSchema` — enough for `hasEnrichment` to be true. */
const CARD = JSON.stringify({
  usage: 'Diễn tả việc buộc phải làm, không còn cách nào khác.',
  example: { ja: '行かざるを得ない。', vi: 'Buộc phải đi.' },
});

beforeAll(async () => {
  P = await import('@/lib/import-preview');
  ({ prisma } = await import('@/lib/db'));
});

describe('the normaliser is what stands between a paste and a duplicated library', () => {
  it.each([
    ['「〜わけにはいかない」', 'quoted with corner brackets'],
    ['～わけにはいかない', 'full-width tilde instead of the wave dash'],
    ['わけにはいかない', 'no attachment mark at all'],
    ['  〜わけにはいかない  ', 'surrounding whitespace'],
  ])('classifies %s (%s) as a duplicate, not new', async (pasted) => {
    const user = await freshUser();
    const itemId = await addItem(user, '〜わけにはいかない');
    const preview = await P.previewImport(user, [candidate(pasted)]);
    expect(preview.counts).toEqual({ new: 0, duplicate: 1, ambiguous: 0 });
    expect(preview.duplicate[0].itemId).toBe(itemId);
    // The learner sees BOTH spellings: what they pasted and what is actually stored.
    expect(preview.duplicate[0].stored).toBe('〜わけにはいかない');
    expect(preview.duplicate[0].expression).toBe(pasted);
  });

  it('folds HALF-WIDTH katakana onto the stored word (this is what NFKC is actually for)', async () => {
    const user = await freshUser();
    const itemId = await addItem(user, 'コーヒー', { kind: 'VOCAB' });
    // ｺｰﾋｰ is what old systems and some OCR output produce; NFKC maps it to コーヒー.
    const preview = await P.previewImport(user, [candidate('ｺｰﾋｰ', 'VOCAB')]);
    expect(preview.counts).toEqual({ new: 0, duplicate: 1, ambiguous: 0 });
    expect(preview.duplicate[0].itemId).toBe(itemId);
  });

  it('does NOT fold katakana onto hiragana — a documented limit, not an oversight', async () => {
    const user = await freshUser();
    await addItem(user, 'わけにはいかない');
    // NFKC normalises WIDTH and compatibility forms; it does not change kana script, and folding it
    // ourselves would be wrong for VOCAB (みる / ミル can be different words). A katakana-written
    // pattern therefore reads as NEW. Pinned so a later session does not "fix" the shared normaliser —
    // which the coach, the lookup and the card merge all depend on — for this rare case.
    const preview = await P.previewImport(user, [candidate('ワケにはいかない')]);
    expect(preview.counts).toEqual({ new: 1, duplicate: 0, ambiguous: 0 });
  });

  it('lets a genuinely different pattern through as new', async () => {
    const user = await freshUser();
    await addItem(user, '〜わけにはいかない');
    const preview = await P.previewImport(user, [candidate('〜ざるを得ない')]);
    expect(preview.counts).toEqual({ new: 1, duplicate: 0, ambiguous: 0 });
    expect(preview.new[0].expression).toBe('〜ざるを得ない');
  });
});

describe('a SUSPENDED duplicate must not be reported as merely "already there"', () => {
  it('flags it so the offer becomes unsuspend, not add', async () => {
    const user = await freshUser();
    const itemId = await addItem(user, '〜ばかりに', { suspended: true });
    const preview = await P.previewImport(user, [candidate('ばかりに')]);
    expect(preview.duplicate).toHaveLength(1);
    expect(preview.duplicate[0]).toMatchObject({ itemId, suspended: true });
  });
});

describe('ambiguous means "a decision is needed", and the reason says which', () => {
  it('reports the same expression owned under the OTHER kind', async () => {
    const user = await freshUser();
    const itemId = await addItem(user, '遠慮', { kind: 'VOCAB' });
    const preview = await P.previewImport(user, [candidate('遠慮', 'GRAMMAR')]);
    expect(preview.counts).toEqual({ new: 0, duplicate: 0, ambiguous: 1 });
    expect(preview.ambiguous[0]).toMatchObject({
      reason: 'other-kind',
      itemId,
      storedKind: 'VOCAB',
    });
  });

  it('reports a repeat WITHIN the pasted material instead of silently collapsing it', async () => {
    const user = await freshUser();
    const preview = await P.previewImport(user, [
      candidate('〜どころか'),
      candidate('「〜どころか」'), // the same pattern, quoted the second time
    ]);
    expect(preview.counts).toEqual({ new: 1, duplicate: 0, ambiguous: 1 });
    expect(preview.ambiguous[0].reason).toBe('repeated');
  });

  it('prefers forking a public copy that already carries a card', async () => {
    const user = await freshUser();
    const sharer = await freshUser();
    const sharedId = await addItem(sharer, '〜てしかたがない', {
      visibility: 'public',
      enrichment: CARD,
    });
    const preview = await P.previewImport(user, [candidate('てしかたがない')]);
    expect(preview.counts).toEqual({ new: 0, duplicate: 0, ambiguous: 1 });
    expect(preview.ambiguous[0]).toMatchObject({
      reason: 'shared-available',
      sharedItemId: sharedId,
      sharedHasCard: true,
    });
    expect(preview.ambiguous[0].sharedOwner).toBeTruthy();
  });

  it('does NOT interrupt for a BARE public copy — it is no better than what was just extracted', async () => {
    const user = await freshUser();
    const sharer = await freshUser();
    await addItem(sharer, '〜つつある', { visibility: 'public' });
    const preview = await P.previewImport(user, [candidate('つつある')]);
    expect(preview.counts).toEqual({ new: 1, duplicate: 0, ambiguous: 0 });
  });

  it('an EXACT match of their own wins over any public copy', async () => {
    const user = await freshUser();
    const sharer = await freshUser();
    await addItem(sharer, '〜ざるを得ない', { visibility: 'public', enrichment: CARD });
    const mineId = await addItem(user, '〜ざるを得ない');
    const preview = await P.previewImport(user, [candidate('「〜ざるを得ない」')]);
    expect(preview.counts).toEqual({ new: 0, duplicate: 1, ambiguous: 0 });
    expect(preview.duplicate[0].itemId).toBe(mineId);
  });
});

describe('tenancy — the dry run only ever sees this learner library', () => {
  it('another member private item is not a duplicate for me', async () => {
    const mine = await freshUser();
    const theirs = await freshUser();
    await addItem(theirs, '〜んがため');
    const preview = await P.previewImport(mine, [candidate('〜んがため')]);
    expect(preview.counts).toEqual({ new: 1, duplicate: 0, ambiguous: 0 });
  });
});

describe('it writes nothing — that is the whole contract', () => {
  it('leaves the library byte-identical after a full preview', async () => {
    const user = await freshUser();
    await addItem(user, '〜わけにはいかない');
    const before = await prisma.item.findMany({ where: {} });
    await P.previewImport(user, [
      candidate('わけにはいかない'),
      candidate('〜ざるを得ない'),
      candidate('遠慮', 'VOCAB'),
    ]);
    const after = await prisma.item.findMany({ where: {} });
    expect(after).toEqual(before);
    expect(await prisma.srsState.count({ where: {} })).toBe(0);
  });
});
