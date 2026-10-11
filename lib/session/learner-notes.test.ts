import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-notes-');

type Notes = typeof import('@/lib/session/learner-notes');
type Practice = typeof import('@/lib/library/practice');
type Db = typeof import('@/lib/db/db');

let N: Notes;
let P: Practice;
let prisma: Db['prisma'];

const NOW = new Date('2026-07-27T10:00:00Z');
const DAY = 86_400_000;

async function resetData(): Promise<void> {
  await resetLearningData(prisma);
}

async function aSentence(): Promise<string> {
  const row = await prisma.sentence.create({
    data: {
      direction: 'VI_JA',
      sourceText: 'nguồn',
      userAnswer: 'đáp',
      status: 'GRADED',
    },
  });
  return row.id;
}

const text = (n: number): string =>
  `Self-corrects out loud before committing, observation number ${n}.`;

beforeAll(async () => {
  N = await import('@/lib/session/learner-notes');
  P = await import('@/lib/library/practice');
  ({ prisma } = await import('@/lib/db/db'));
});

describe('falsifiable — a note without CHECKABLE evidence is not written', () => {
  it('rejects an empty evidence list', async () => {
    await resetData();
    const res = await N.recordLearnerNote({ text: text(1), evidence: [] }, NOW);
    expect(res).toEqual({ recorded: 'rejected', reason: 'no-evidence' });
    expect(await N.listLearnerNotes(NOW)).toEqual([]);
  });

  it('rejects a note whose evidence resolves to NOTHING (a hallucinated citation)', async () => {
    await resetData();
    const res = await N.recordLearnerNote(
      { text: text(2), evidence: ['made-up-id', 'another-made-up-id'] },
      NOW,
    );
    expect(res).toEqual({ recorded: 'rejected', reason: 'unknown-evidence' });
    expect(await N.listLearnerNotes(NOW)).toEqual([]);
  });

  it('keeps only the ids that really resolve, and writes the note', async () => {
    await resetData();
    const real = await aSentence();
    const res = await N.recordLearnerNote({ text: text(3), evidence: [real, 'ghost-id'] }, NOW);
    expect(res.recorded).toBe('added');
    const [note] = await N.listLearnerNotes(NOW);
    expect(note.evidence).toEqual([real]);
    expect(note.expiresAt.getTime()).toBe(NOW.getTime() + N.NOTE_TTL_DAYS * DAY);
  });

  it('refuses a note too short to be a claim, and one long enough to be a diary', async () => {
    await resetData();
    const real = await aSentence();
    expect(await N.recordLearnerNote({ text: 'ok', evidence: [real] }, NOW)).toEqual({
      recorded: 'rejected',
      reason: 'too-short',
    });
    expect(
      await N.recordLearnerNote({ text: 'x'.repeat(N.MAX_NOTE_CHARS + 1), evidence: [real] }, NOW),
    ).toEqual({ recorded: 'rejected', reason: 'too-long' });
  });
});

describe('bounded — the annex cannot grow', () => {
  it('re-asserting the same observation RENEWS it instead of taking a second slot', async () => {
    await resetData();
    const first = await aSentence();
    const second = await aSentence();
    await N.recordLearnerNote({ text: text(4), evidence: [first] }, NOW);

    const later = new Date(NOW.getTime() + 10 * DAY);
    const res = await N.recordLearnerNote(
      { text: `  ${text(4).toUpperCase()}  `, evidence: [second] },
      later,
    );
    expect(res.recorded).toBe('refreshed');
    const notes = await N.listLearnerNotes(later);
    expect(notes).toHaveLength(1);
    expect(notes[0].evidence).toEqual(expect.arrayContaining([first, second]));
    expect(notes[0].expiresAt.getTime()).toBe(later.getTime() + N.NOTE_TTL_DAYS * DAY);
  });

  it('evicts the note with the LEAST remaining life when a new one arrives at the cap', async () => {
    await resetData();
    const s = await aSentence();
    for (let i = 0; i < N.MAX_ASSERTED_NOTES; i++) {
      await N.recordLearnerNote(
        { text: text(100 + i), evidence: [s] },
        new Date(NOW.getTime() + i * DAY),
      );
    }
    const before = await N.listLearnerNotes(NOW);
    expect(before).toHaveLength(N.MAX_ASSERTED_NOTES);
    const doomed = before.find((n) => n.text === text(100));
    expect(doomed).toBeDefined();

    const res = await N.recordLearnerNote(
      { text: text(999), evidence: [s] },
      new Date(NOW.getTime() + N.MAX_ASSERTED_NOTES * DAY),
    );
    expect(res.recorded).toBe('added');
    if (res.recorded !== 'added') throw new Error('unreachable');
    expect(res.evicted).toBe(doomed!.id);

    const after = await N.listLearnerNotes(new Date(NOW.getTime() + N.MAX_ASSERTED_NOTES * DAY));
    expect(after).toHaveLength(N.MAX_ASSERTED_NOTES);
    expect(after.map((n) => n.text)).not.toContain(text(100));
    expect(after.map((n) => n.text)).toContain(text(999));
  });
});

describe('self-cleaning — a claim about a person has a shelf life', () => {
  it('stops returning a note once it expires', async () => {
    await resetData();
    const s = await aSentence();
    await N.recordLearnerNote({ text: text(5), evidence: [s] }, NOW);
    const afterTtl = new Date(NOW.getTime() + (N.NOTE_TTL_DAYS + 1) * DAY);
    expect(await N.listLearnerNotes(afterTtl)).toEqual([]);
  });
});

describe('5.4 — the note is a PASSENGER on submit_review, never a toll on it', () => {
  async function gradedTurn(note?: { text: string; evidence: string[] }) {
    await P.addItems([{ expression: '〜ばかりに', meaningVi: 'nghĩa' }]);
    const item = (await P.listItems()).find((i) => i.expression === '〜ばかりに');
    if (!item) throw new Error('seed failed');
    const { sentenceId } = await P.stageSentence({
      direction: 'VI_JA',
      sourceText: 'câu nguồn',
      suggested: 'reference',
      items: [{ itemId: item.itemId, role: 'TARGET' }],
    });
    return P.submitReview({
      sentenceId,
      userAnswer: 'đáp án',
      ratings: [{ itemId: item.itemId, rating: 3 }],
      ...(note
        ? { learnerNote: { text: note.text, evidence: [...note.evidence, sentenceId] } }
        : {}),
    });
  }

  it('records nothing and reports null when no note is sent', async () => {
    await resetData();
    const result = await gradedTurn();
    expect(result.learnerNote).toBeNull();
    expect(await N.listLearnerNotes()).toEqual([]);
  });

  it('stores the note and echoes the outcome so Claude is not left guessing', async () => {
    await resetData();
    const result = await gradedTurn({ text: text(7), evidence: [] });
    expect(result.learnerNote?.recorded).toBe('added');
    const [stored] = await N.listLearnerNotes();
    expect(stored.text).toBe(text(7));
    expect(stored.evidence).toContain(result.sentenceId);
  });

  it('still writes the FSRS review when the note is REJECTED', async () => {
    await resetData();
    const result = await gradedTurn({ text: 'no', evidence: [] });
    expect(result.learnerNote).toEqual({ recorded: 'rejected', reason: 'too-short' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].nextDue).toBeInstanceOf(Date);
    expect(await prisma.reviewLog.count({ where: {} })).toBe(1);
    expect(await N.listLearnerNotes()).toEqual([]);
  });
});

describe('the annex reaches the tutor through the dossier, not through a new tool', () => {
  it('a note alone is enough to make the dossier non-empty', async () => {
    const D = await import('@/lib/session/dossier');
    await resetData();
    const s = await aSentence();
    expect(D.isEmptyDossier(await D.computeDossier(NOW))).toBe(true);
    await N.recordLearnerNote({ text: text(8), evidence: [s] }, NOW);
    const dossier = await D.computeDossier(NOW);
    expect(D.isEmptyDossier(dossier)).toBe(false);
    expect(dossier.notes.map((n) => n.text)).toEqual([text(8)]);
  });

  it('but notes NEVER reach the rendered digest — they ride the JSON only', async () => {
    const D = await import('@/lib/session/dossier');
    const R = await import('@/lib/mcp/render');
    await resetData();
    const s = await aSentence();
    await N.recordLearnerNote({ text: text(9), evidence: [s] }, NOW);
    const block = R.renderDossier(await D.computeDossier(NOW));
    expect(block).toBeNull();
  });
});
