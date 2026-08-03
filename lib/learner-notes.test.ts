// DB harness for the ASSERTED half of the student model (plan step 5.2 / 5.4).
//
// The three properties whose ABSENCE killed the study plan are the three things asserted here:
// falsifiable (evidence must be the learner's own, verified), bounded (a sixth note evicts), and
// self-cleaning (expired notes are invisible). Plus the passenger rule from 5.4 — a bad note must
// never cost the learner the FSRS write they earned.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-notes-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Notes = typeof import('@/lib/learner-notes');
type Practice = typeof import('@/lib/practice');
type Db = typeof import('@/lib/db');

let N: Notes;
let P: Practice;
let prisma: Db['prisma'];

const NOW = new Date('2026-07-27T10:00:00Z');
const DAY = 86_400_000;

let seq = 0;
async function freshUser(): Promise<string> {
  const id = `n${seq++}`;
  await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
  return id;
}

async function aSentence(userId: string): Promise<string> {
  const row = await prisma.sentence.create({
    data: {
      userId,
      direction: 'VI_JA',
      sourceText: 'nguồn',
      userAnswer: 'đáp',
      status: 'GRADED',
    },
  });
  return row.id;
}

/** A note long enough to clear MIN_NOTE_CHARS, distinct per call. */
const text = (n: number): string =>
  `Self-corrects out loud before committing, observation number ${n}.`;

beforeAll(async () => {
  N = await import('@/lib/learner-notes');
  P = await import('@/lib/practice');
  ({ prisma } = await import('@/lib/db'));
});

describe('falsifiable — a note without CHECKABLE evidence is not written', () => {
  it('rejects an empty evidence list', async () => {
    const user = await freshUser();
    const res = await N.recordLearnerNote(user, { text: text(1), evidence: [] }, NOW);
    expect(res).toEqual({ recorded: 'rejected', reason: 'no-evidence' });
    expect(await N.listLearnerNotes(user, NOW)).toEqual([]);
  });

  it('rejects ids that are not this learner sentences (a hallucinated citation)', async () => {
    const user = await freshUser();
    const stranger = await freshUser();
    const theirs = await aSentence(stranger);
    const res = await N.recordLearnerNote(
      user,
      { text: text(2), evidence: ['made-up-id', theirs] },
      NOW,
    );
    expect(res).toEqual({ recorded: 'rejected', reason: 'unknown-evidence' });
    expect(await N.listLearnerNotes(user, NOW)).toEqual([]);
  });

  it('keeps only the ids that really resolve, and writes the note', async () => {
    const user = await freshUser();
    const real = await aSentence(user);
    const res = await N.recordLearnerNote(
      user,
      { text: text(3), evidence: [real, 'ghost-id'] },
      NOW,
    );
    expect(res.recorded).toBe('added');
    const [note] = await N.listLearnerNotes(user, NOW);
    expect(note.evidence).toEqual([real]);
    expect(note.expiresAt.getTime()).toBe(NOW.getTime() + N.NOTE_TTL_DAYS * DAY);
  });

  it('refuses a note too short to be a claim, and one long enough to be a diary', async () => {
    const user = await freshUser();
    const real = await aSentence(user);
    expect(await N.recordLearnerNote(user, { text: 'ok', evidence: [real] }, NOW)).toEqual({
      recorded: 'rejected',
      reason: 'too-short',
    });
    expect(
      await N.recordLearnerNote(
        user,
        { text: 'x'.repeat(N.MAX_NOTE_CHARS + 1), evidence: [real] },
        NOW,
      ),
    ).toEqual({ recorded: 'rejected', reason: 'too-long' });
  });
});

describe('bounded — the annex cannot grow', () => {
  it('re-asserting the same observation RENEWS it instead of taking a second slot', async () => {
    const user = await freshUser();
    const first = await aSentence(user);
    const second = await aSentence(user);
    await N.recordLearnerNote(user, { text: text(4), evidence: [first] }, NOW);

    const later = new Date(NOW.getTime() + 10 * DAY);
    // Same claim, reworded only in case and spacing — the shape a later session actually produces.
    const res = await N.recordLearnerNote(
      user,
      { text: `  ${text(4).toUpperCase()}  `, evidence: [second] },
      later,
    );
    expect(res.recorded).toBe('refreshed');
    const notes = await N.listLearnerNotes(user, later);
    expect(notes).toHaveLength(1);
    expect(notes[0].evidence).toEqual(expect.arrayContaining([first, second]));
    expect(notes[0].expiresAt.getTime()).toBe(later.getTime() + N.NOTE_TTL_DAYS * DAY);
  });

  it('evicts the note with the LEAST remaining life when a new one arrives at the cap', async () => {
    const user = await freshUser();
    const s = await aSentence(user);
    // Written on consecutive days, so the oldest also expires soonest.
    for (let i = 0; i < N.MAX_ASSERTED_NOTES; i++) {
      await N.recordLearnerNote(
        user,
        { text: text(100 + i), evidence: [s] },
        new Date(NOW.getTime() + i * DAY),
      );
    }
    const before = await N.listLearnerNotes(user, NOW);
    expect(before).toHaveLength(N.MAX_ASSERTED_NOTES);
    const doomed = before.find((n) => n.text === text(100));
    expect(doomed).toBeDefined();

    const res = await N.recordLearnerNote(
      user,
      { text: text(999), evidence: [s] },
      new Date(NOW.getTime() + N.MAX_ASSERTED_NOTES * DAY),
    );
    expect(res.recorded).toBe('added');
    if (res.recorded !== 'added') throw new Error('unreachable');
    expect(res.evicted).toBe(doomed!.id);

    const after = await N.listLearnerNotes(
      user,
      new Date(NOW.getTime() + N.MAX_ASSERTED_NOTES * DAY),
    );
    expect(after).toHaveLength(N.MAX_ASSERTED_NOTES);
    expect(after.map((n) => n.text)).not.toContain(text(100));
    expect(after.map((n) => n.text)).toContain(text(999));
  });
});

describe('self-cleaning — a claim about a person has a shelf life', () => {
  it('stops returning a note once it expires', async () => {
    const user = await freshUser();
    const s = await aSentence(user);
    await N.recordLearnerNote(user, { text: text(5), evidence: [s] }, NOW);
    const afterTtl = new Date(NOW.getTime() + (N.NOTE_TTL_DAYS + 1) * DAY);
    expect(await N.listLearnerNotes(user, afterTtl)).toEqual([]);
  });

  it('never leaks another learner notes', async () => {
    const mine = await freshUser();
    const theirs = await freshUser();
    const s = await aSentence(theirs);
    await N.recordLearnerNote(theirs, { text: text(6), evidence: [s] }, NOW);
    expect(await N.listLearnerNotes(mine, NOW)).toEqual([]);
    expect(await N.listLearnerNotes(theirs, NOW)).toHaveLength(1);
  });
});

describe('5.4 — the note is a PASSENGER on submit_review, never a toll on it', () => {
  async function gradedTurn(user: string, note?: { text: string; evidence: string[] }) {
    await P.addItems(user, [{ expression: '〜ばかりに', meaningVi: 'nghĩa' }]);
    const item = (await P.listItems(user)).find((i) => i.expression === '〜ばかりに');
    if (!item) throw new Error('seed failed');
    const { sentenceId } = await P.stageSentence(user, {
      direction: 'VI_JA',
      sourceText: 'câu nguồn',
      suggested: 'reference',
      items: [{ itemId: item.itemId, role: 'TARGET' }],
    });
    return P.submitReview(user, {
      sentenceId,
      userAnswer: 'đáp án',
      ratings: [{ itemId: item.itemId, rating: 3 }],
      ...(note
        ? { learnerNote: { text: note.text, evidence: [...note.evidence, sentenceId] } }
        : {}),
    });
  }

  it('records nothing and reports null when no note is sent', async () => {
    const user = await freshUser();
    const result = await gradedTurn(user);
    expect(result.learnerNote).toBeNull();
    expect(await N.listLearnerNotes(user)).toEqual([]);
  });

  it('stores the note and echoes the outcome so Claude is not left guessing', async () => {
    const user = await freshUser();
    const result = await gradedTurn(user, { text: text(7), evidence: [] });
    expect(result.learnerNote?.recorded).toBe('added');
    const [stored] = await N.listLearnerNotes(user);
    expect(stored.text).toBe(text(7));
    // The turn being graded is itself the evidence, which is why the id is available at write time.
    expect(stored.evidence).toContain(result.sentenceId);
  });

  it('still writes the FSRS review when the note is REJECTED', async () => {
    const user = await freshUser();
    const result = await gradedTurn(user, { text: 'no', evidence: [] });
    expect(result.learnerNote).toEqual({ recorded: 'rejected', reason: 'too-short' });
    // The thing the learner actually earned survived the bad passenger.
    expect(result.items).toHaveLength(1);
    expect(result.items[0].nextDue).toBeInstanceOf(Date);
    expect(await prisma.reviewLog.count({ where: { userId: user } })).toBe(1);
    expect(await N.listLearnerNotes(user)).toEqual([]);
  });
});

describe('the annex reaches the tutor through the dossier, not through a new tool', () => {
  it('a note alone is enough to make the dossier non-empty', async () => {
    const D = await import('@/lib/dossier');
    const user = await freshUser();
    const s = await aSentence(user);
    expect(D.isEmptyDossier(await D.computeDossier(user, NOW))).toBe(true);
    await N.recordLearnerNote(user, { text: text(8), evidence: [s] }, NOW);
    const dossier = await D.computeDossier(user, NOW);
    expect(D.isEmptyDossier(dossier)).toBe(false);
    expect(dossier.notes.map((n) => n.text)).toEqual([text(8)]);
  });

  it('but notes NEVER reach the rendered digest — they ride the JSON only', async () => {
    const D = await import('@/lib/dossier');
    const R = await import('@/lib/mcp/render');
    const user = await freshUser();
    const s = await aSentence(user);
    await N.recordLearnerNote(user, { text: text(9), evidence: [s] }, NOW);
    const block = R.renderDossier(await D.computeDossier(user, NOW));
    // A note is prose Claude wrote about a person: it counts toward "the dossier is not empty" but is
    // never printed back as a derived-looking bullet. Claude reads it from `dossier.notes` in the
    // get_stats JSON, where it still carries its date and its evidence ids.
    expect(block).toBeNull();
  });
});
