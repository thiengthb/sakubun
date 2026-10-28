import { parseScript, plainJapanese, type ScriptLine } from '@/lib/kaiwa/parse';

// How a script reads as a chat (thien, 2026-10-27): the learner picks who they are, their lines sit
// on the left and everyone else's on the right. A line with no speaker inside a dialogue
// (店の中は静かだった。) is the scene, not a turn, so it sits in the middle; a script with no speakers
// at all is a monologue and reads as plain text. Pure: the page renders what this returns.

export type Turn<L extends ScriptLine = ScriptLine> =
  | { kind: 'scene'; line: L }
  | { kind: 'narration'; line: L }
  | {
      kind: 'speech';
      line: L;
      side: 'mine' | 'theirs';
      // Lines in a row from one speaker form a run: the speaker's mark shows once, on the first.
      firstOfRun: boolean;
      // 0 for the learner, then 1, 2, … for the others in the order they first speak.
      tone: number;
    };

export function scriptSpeakers(lines: readonly ScriptLine[]): string[] {
  return [...new Set(lines.flatMap((l) => (l.speaker === null ? [] : [l.speaker])))];
}

// The part the learner chose on this script, if it still has them; else the part they took on the
// last script they chose one in, when this script has it too (often their own name, thien 7.4);
// else whoever speaks first.
export function chooseMe(
  speakers: readonly string[],
  stored: string | null,
  last: string | null = null,
): string | null {
  if (stored !== null && speakers.includes(stored)) return stored;
  if (last !== null && speakers.includes(last)) return last;
  return speakers[0] ?? null;
}

export function layoutTurns<L extends ScriptLine>(
  lines: readonly L[],
  me: string | null,
): Turn<L>[] {
  const speakers = scriptSpeakers(lines);
  if (speakers.length === 0) return lines.map((line) => ({ kind: 'narration', line }));
  const others = speakers.filter((s) => s !== me);
  let previous: string | null = null;
  return lines.map((line) => {
    const speaker = line.speaker;
    if (speaker === null) {
      previous = null;
      return { kind: 'scene', line };
    }
    const firstOfRun = speaker !== previous;
    previous = speaker;
    const mine = speaker === me;
    return {
      kind: 'speech',
      line,
      side: mine ? 'mine' : 'theirs',
      firstOfRun,
      tone: mine ? 0 : others.indexOf(speaker) + 1,
    };
  });
}

// What a script's card on the list says about it (thien, 7.4g): how long it is, who speaks, and
// its first spoken line (the scene before it says less), as the learner reads it.
export function digestScript(body: string): {
  lineCount: number;
  speakers: string[];
  firstLine: string;
} {
  const lines = parseScript(body);
  const first = lines.find((l) => l.speaker !== null) ?? lines[0];
  return {
    lineCount: lines.length,
    speakers: scriptSpeakers(lines),
    firstLine: first ? plainJapanese(first.japanese) : '',
  };
}
