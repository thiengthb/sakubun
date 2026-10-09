import { prisma } from '@/lib/db';

export const MAX_ASSERTED_NOTES = 5;

export const MAX_NOTE_EVIDENCE = 3;

export const MIN_NOTE_CHARS = 15;
export const MAX_NOTE_CHARS = 240;

export const NOTE_TTL_DAYS = 60;

const DAY_MS = 86_400_000;

export interface AssertedNote {
  id: string;
  text: string;
  evidence: string[];
  createdAt: Date;
  expiresAt: Date;
}

export interface LearnerNoteInput {
  text: string;
  evidence: string[];
}

export type RecordNoteResult =
  | { recorded: 'added'; note: AssertedNote; evicted: string | null }
  | { recorded: 'refreshed'; note: AssertedNote }
  | { recorded: 'rejected'; reason: 'too-short' | 'too-long' | 'no-evidence' | 'unknown-evidence' };

function noteKey(text: string): string {
  return text.trim().replace(/\s+/gu, ' ').toLowerCase();
}

function parseEvidence(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

interface NoteRow {
  id: string;
  text: string;
  evidence: string;
  createdAt: Date;
  expiresAt: Date;
}

const toNote = (row: NoteRow): AssertedNote => ({
  id: row.id,
  text: row.text,
  evidence: parseEvidence(row.evidence),
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
});

export async function listLearnerNotes(
  now: Date = new Date(),
): Promise<AssertedNote[]> {
  const rows = await prisma.learnerNote.findMany({
    where: { expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    take: MAX_ASSERTED_NOTES,
  });
  return rows.map(toNote);
}

export interface AssertedNoteWithEvidence extends AssertedNote {
  evidenceSentences: {
    id: string;
    sourceText: string;
    sourceRuby: string | null;
    direction: string;
    createdAt: Date;
  }[];
}

export async function listLearnerNotesWithEvidence(
  now: Date = new Date(),
): Promise<AssertedNoteWithEvidence[]> {
  const notes = await listLearnerNotes(now);
  const ids = [...new Set(notes.flatMap((n) => n.evidence))];
  if (ids.length === 0) return notes.map((n) => ({ ...n, evidenceSentences: [] }));

  const rows = await prisma.sentence.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      sourceText: true,
      sourceRuby: true,
      direction: true,
      createdAt: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return notes.map((n) => ({
    ...n,
    evidenceSentences: n.evidence.map((id) => byId.get(id)).filter((r) => r !== undefined),
  }));
}

export async function recordLearnerNote(
  input: LearnerNoteInput,
  now: Date = new Date(),
): Promise<RecordNoteResult> {
  const text = input.text.trim().replace(/\s+/gu, ' ');
  if (text.length < MIN_NOTE_CHARS) return { recorded: 'rejected', reason: 'too-short' };
  if (text.length > MAX_NOTE_CHARS) return { recorded: 'rejected', reason: 'too-long' };

  const claimed = [...new Set(input.evidence.map((id) => id.trim()).filter(Boolean))];
  if (claimed.length === 0) return { recorded: 'rejected', reason: 'no-evidence' };

  const owned = await prisma.sentence.findMany({
    where: { id: { in: claimed } },
    select: { id: true },
  });
  const evidence = owned.map((s) => s.id).slice(0, MAX_NOTE_EVIDENCE);
  if (evidence.length === 0) return { recorded: 'rejected', reason: 'unknown-evidence' };

  const expiresAt = new Date(now.getTime() + NOTE_TTL_DAYS * DAY_MS);
  const live = await prisma.learnerNote.findMany({
    where: { expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });

  const key = noteKey(text);
  const existing = live.find((row) => noteKey(row.text) === key);
  if (existing) {
    const merged = [...new Set([...evidence, ...parseEvidence(existing.evidence)])].slice(
      0,
      MAX_NOTE_EVIDENCE,
    );
    const updated = await prisma.learnerNote.update({
      where: { id: existing.id },
      data: { evidence: JSON.stringify(merged), expiresAt },
    });
    return { recorded: 'refreshed', note: toNote(updated) };
  }

  let evicted: string | null = null;
  if (live.length >= MAX_ASSERTED_NOTES) {
    const victim = [...live].sort(
      (a, b) =>
        a.expiresAt.getTime() - b.expiresAt.getTime() ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )[0];
    evicted = victim.id;
    await prisma.learnerNote.delete({ where: { id: victim.id } });
  }
  await prisma.learnerNote.deleteMany({ where: { expiresAt: { lte: now } } });

  const created = await prisma.learnerNote.create({
    data: { text, evidence: JSON.stringify(evidence), expiresAt },
  });
  return { recorded: 'added', note: toNote(created), evicted };
}
