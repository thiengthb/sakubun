import { scriptSpeakers } from '@/lib/kaiwa/layout';
import type { ScriptLine } from '@/lib/kaiwa/parse';
import { findPart } from '@/lib/kaiwa/roleplay';

// A finished role-play as kaiwa_roleplay_save hands it in (Kaiwa d,
// docs/plans/2026-11-07-kaiwa-voices-roleplay.md): the learner's turns, each with what they said,
// whether it meant the same as the model line, and one line of feedback. The turn numbers are the
// ones kaiwa_roleplay gave (1-based line numbers). Pure: lib/kaiwa/roleplays.ts writes it.

export interface RoleplayTurn {
  turn: number;
  said: string;
  ok: boolean;
  note?: string;
}

export const ROLEPLAY_LIMITS = { turns: 60, said: 500, note: 300 } as const;

export type CheckedRoleplay =
  { ok: true; part: string; turns: RoleplayTurn[]; correct: number } | { ok: false; error: string };

// The turns sorted, trimmed and checked against the script, or what to fix, said for the AI.
export function checkRoleplay(
  lines: readonly ScriptLine[],
  part: string,
  turns: readonly RoleplayTurn[],
): CheckedRoleplay {
  const speakers = scriptSpeakers(lines);
  const me = findPart(speakers, part);
  if (!me) return { ok: false, error: `No part "${part}". Parts: ${speakers.join(', ')}.` };
  if (turns.length === 0)
    return { ok: false, error: "No turns. Send each of the learner's turns from the role-play." };
  if (turns.length > ROLEPLAY_LIMITS.turns)
    return { ok: false, error: `At most ${ROLEPLAY_LIMITS.turns} turns; send each turn once.` };
  const mine = new Set(lines.flatMap((line, i) => (line.speaker === me ? [i + 1] : [])));
  const seen = new Set<number>();
  const clean: RoleplayTurn[] = [];
  for (const t of turns) {
    if (!mine.has(t.turn))
      return {
        ok: false,
        error: `Turn ${t.turn} is not ${me}'s. ${me}'s turns: ${[...mine].join(', ')}.`,
      };
    if (seen.has(t.turn))
      return { ok: false, error: `Turn ${t.turn} is twice; send its last try once.` };
    seen.add(t.turn);
    const said = t.said.trim();
    if (!said) return { ok: false, error: `Turn ${t.turn}: "said" is empty.` };
    if (said.length > ROLEPLAY_LIMITS.said)
      return {
        ok: false,
        error: `Turn ${t.turn}: "said" is over ${ROLEPLAY_LIMITS.said} characters.`,
      };
    const note = t.note?.trim();
    if (note && note.length > ROLEPLAY_LIMITS.note)
      return {
        ok: false,
        error: `Turn ${t.turn}: "note" is over ${ROLEPLAY_LIMITS.note} characters.`,
      };
    clean.push({ turn: t.turn, said, ok: t.ok, ...(note ? { note } : {}) });
  }
  clean.sort((a, b) => a.turn - b.turn);
  return { ok: true, part: me, turns: clean, correct: clean.filter((t) => t.ok).length };
}

// The turns stored on a row; anything unreadable is left out rather than breaking Lịch sử.
export function readRoleplayTurns(raw: string): RoleplayTurn[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is RoleplayTurn =>
        !!t &&
        typeof t === 'object' &&
        typeof (t as RoleplayTurn).turn === 'number' &&
        typeof (t as RoleplayTurn).said === 'string' &&
        typeof (t as RoleplayTurn).ok === 'boolean',
    );
  } catch {
    return [];
  }
}
