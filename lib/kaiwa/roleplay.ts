import { plainJapanese, type ScriptLine } from '@/lib/kaiwa/parse';
import { scriptSpeakers } from '@/lib/kaiwa/layout';

// Role-play over MCP (K8, docs/plans/2026-10-31-k8-kaiwa-roleplay.md): the AI plays every part but
// the learner's, one turn at a time. The script is handed over as numbered turns so the AI knows
// whose turn it is and what the model line is. Pure: lib/mcp/tools/kaiwa.ts reads the script.

export type RoleplayResult = { ok: true; text: string } | { ok: false; error: string };

// The part the learner named, matched without case (a, Ta, 田中), or null.
export function findPart(speakers: readonly string[], part: string): string | null {
  const wanted = part.trim().toLowerCase();
  return speakers.find((s) => s.toLowerCase() === wanted) ?? null;
}

export function roleplayScript(
  title: string,
  lines: readonly ScriptLine[],
  part: string,
): RoleplayResult {
  const speakers = scriptSpeakers(lines);
  if (speakers.length < 2) {
    return {
      ok: false,
      error:
        'This script has no parts to play (a monologue). Suggest the learner practise it on the web with "Nghe cả bài" and "Che câu của tôi".',
    };
  }
  const me = findPart(speakers, part);
  if (!me) return { ok: false, error: `No part "${part}". Parts: ${speakers.join(', ')}.` };

  const ai = speakers.filter((s) => s !== me);
  const turns = lines.map((line, i) => {
    const who =
      line.speaker === null
        ? 'SCENE'
        : line.speaker === me
          ? `LEARNER ${me}`
          : `YOU ${line.speaker}`;
    const meaning = line.translation ? ` | ${line.translation}` : '';
    return `${i + 1} ${who}: ${plainJapanese(line.japanese)}${meaning}`;
  });
  return {
    ok: true,
    text: [
      `Role-play "${title}": the learner is ${me}, you play ${ai.join(', ')}. ${lines.length} turns.`,
      ...turns,
      'Rules: speak Vietnamese with the learner, Japanese in the scene.',
      'Say SCENE lines in one short Vietnamese sentence. Say only your own turns, one at a time, then stop and wait.',
      "Never write the learner's line before they try. When they answer, compare it with the model line: same meaning, go on; otherwise correct it briefly in Vietnamese and let them try again once.",
      'If they ask for a hint, give the first few words of the model line. If they say "tự do", improvise in the same scene instead of following the lines.',
      'At the end, name the lines they said well and the ones to practise again.',
    ].join('\n'),
  };
}
