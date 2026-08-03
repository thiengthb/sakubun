// The ASSERTED half of the student model: a small prose annex to the derived aggregates in
// `lib/dossier.ts`. Claude writes these; the app decides whether they may exist.
//
// WHY THIS IS SO CONSTRAINED. A free-form, model-authored memory of the learner is the richest option
// on paper and the one that already failed here: the study plan (built 2026-07-12, deleted 2026-07-14)
// was unverifiable and grew monotonically. The user accepted this feature only in a bounded form
// (plan 2026-07-26-agentic-tutor-loop §7), and the bounds are the feature:
//
//   FALSIFIABLE — every note cites sentenceIds the learner can re-read to argue with it, and those ids
//                 are VERIFIED to be theirs before the row is written. A note whose evidence cannot be
//                 re-read is not evidence, it is an opinion wearing a citation.
//   BOUNDED     — MAX_ASSERTED_NOTES, enforced on insert by EVICTING, never by growing.
//   READABLE BY THE SUBJECT — the text is VIETNAMESE, not the English every other Claude-facing string
//                 uses. The `verbatim` boundary rule says model-only text is English *because it can
//                 never reach the learner*; that condition fails here by design (step 5.6 puts these
//                 notes on the dashboard), and a claim about someone they cannot read is not one they
//                 can challenge. Found while building the surface, corrected here.
//   SELF-CLEANING — every note expires. A claim about a person has a shelf life; the derived half is
//                 recomputed from scratch each read and needs no such thing, which is exactly why the
//                 derived half is the backbone and this is the annex.
//
// Its own module rather than part of `lib/practice.ts` (which would be a cycle: `lib/dossier.ts`
// already imports practice) and rather than a slot in the Settings JSON blob (which has no
// compare-and-set, so a note written on the hot review path would race a settings save from the web).
// Same shape as `lib/calibration.ts`: a separate owner, written as a passenger on `submitReview`.

import { prisma } from '@/lib/db';

/** Hard cap. A sixth note evicts one — the count can never drift upward. */
export const MAX_ASSERTED_NOTES = 5;

/** Evidence is a sample the learner can check, not an archive (same rule as mined pairs). */
export const MAX_NOTE_EVIDENCE = 3;

/** Long enough to be a claim, short enough not to become a diary. */
export const MIN_NOTE_CHARS = 15;
export const MAX_NOTE_CHARS = 240;

/** How long an observation about a person stays credible without being re-asserted. */
export const NOTE_TTL_DAYS = 60;

const DAY_MS = 86_400_000;

export interface AssertedNote {
  id: string;
  /** Vietnamese — the learner reads this on their dashboard (see the header). */
  text: string;
  /** Sentence ids supporting the claim — all verified to belong to this learner when written. */
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
  /** The same observation already stood: its life was extended and any new evidence merged in. */
  | { recorded: 'refreshed'; note: AssertedNote }
  | { recorded: 'rejected'; reason: 'too-short' | 'too-long' | 'no-evidence' | 'unknown-evidence' };

/** Collapse whitespace + case so "the same observation, reworded slightly" is recognised as the same. */
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

/**
 * This learner's live notes, newest first.
 *
 * Expired rows are filtered on READ rather than deleted on a schedule: there is no cron in this app,
 * and a row that stops being read is already gone as far as every consumer is concerned. They are
 * cleaned up opportunistically when a write needs to evict.
 */
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
  /**
   * The cited sentences themselves, so the dashboard can show the claim and its support together.
   * `direction` + `sourceRuby` ride along because a JA_VI source is JAPANESE and invariant #9 then
   * requires it to render playable, with furigana — a citation is not an excuse to ship dead text.
   */
  evidenceSentences: {
    id: string;
    sourceText: string;
    sourceRuby: string | null;
    direction: string;
    createdAt: Date;
  }[];
}

/**
 * The web read: notes WITH the text of the sentences they cite.
 *
 * The evidence is inlined rather than linked. A link would make challenging a note a navigation task;
 * putting the claim and the sentence that produced it on the same line is what actually lets someone
 * say "no, that is not what happened there".
 */
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
  // A cited sentence CAN be gone (the learner deleted it). The note survives with less support rather
  // than disappearing — and showing fewer quotes than it claims is itself informative.
  return notes.map((n) => ({
    ...n,
    evidenceSentences: n.evidence.map((id) => byId.get(id)).filter((r) => r !== undefined),
  }));
}

/**
 * Record one observation about the learner, or refuse to.
 *
 * Refusal is the common, healthy outcome — it is returned, never thrown, because this runs as a
 * passenger on `submitReview` and a bad note must never cost the learner their FSRS write.
 */
export async function recordLearnerNote(
  input: LearnerNoteInput,
  now: Date = new Date(),
): Promise<RecordNoteResult> {
  const text = input.text.trim().replace(/\s+/gu, ' ');
  if (text.length < MIN_NOTE_CHARS) return { recorded: 'rejected', reason: 'too-short' };
  if (text.length > MAX_NOTE_CHARS) return { recorded: 'rejected', reason: 'too-long' };

  const claimed = [...new Set(input.evidence.map((id) => id.trim()).filter(Boolean))];
  if (claimed.length === 0) return { recorded: 'rejected', reason: 'no-evidence' };

  // The check that makes the note falsifiable rather than merely cited: the ids must be sentences
  // THIS learner actually has. A hallucinated id would produce a claim nobody can ever check, which
  // is precisely the property the asserted tier was allowed to exist without.
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

  // Re-observing the same thing is the NORMAL case across sessions. Without this, five slots fill
  // with rewordings of one observation and the annex says a single thing five times.
  const key = noteKey(text);
  const existing = live.find((row) => noteKey(row.text) === key);
  if (existing) {
    const merged = [...new Set([...evidence, ...parseEvidence(existing.evidence)])].slice(
      0,
      MAX_NOTE_EVIDENCE,
    );
    // `userId` in the where is not decoration: lib/db.ts is fail-closed and REFUSES an unscoped
    // update on a tenant model, which is what caught this the first time it was written.
    const updated = await prisma.learnerNote.update({
      where: { id: existing.id },
      data: { evidence: JSON.stringify(merged), expiresAt },
    });
    return { recorded: 'refreshed', note: toNote(updated) };
  }

  // Evict the note with the LEAST remaining life (tie-break: the oldest). Dropping what was about to
  // expire anyway costs the least information, and it makes the cap a rolling window rather than a
  // first-five-wins race.
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
  // Opportunistic cleanup of anything already expired — no cron exists, and this is the only moment
  // the table is being written anyway.
  await prisma.learnerNote.deleteMany({ where: { expiresAt: { lte: now } } });

  const created = await prisma.learnerNote.create({
    data: { text, evidence: JSON.stringify(evidence), expiresAt },
  });
  return { recorded: 'added', note: toNote(created), evicted };
}
