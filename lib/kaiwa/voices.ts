import { VOICE_SPEAKERS } from '@/lib/settings/schema';

// A voice per speaker (K6b, docs/plans/2026-10-31-k6-kaiwa-listening.md): the learner's part keeps
// the voice chosen in Cài đặt, and every other part gets a voice of its own in the order it first
// speaks, a man's and a woman's in turn starting with the other kind, and never a character
// already speaking. The same script and the same choice always give the same voices. A voice the
// learner chose for a part on this script (Kaiwa c, docs/plans/2026-11-07-kaiwa-voices-roleplay.md)
// wins over all of that, their own part included. Pure.

/** The voices chosen per part on one script, by speaker label. */
export type ChosenVoices = Readonly<Record<string, number>>;

interface Voice {
  id: number;
  male: boolean;
  character: string;
}

const VOICES: Voice[] = VOICE_SPEAKERS.map(({ id, label }) => ({
  id,
  male: label.startsWith('Nam'),
  character: /\((.+)\)/.exec(label)?.[1] ?? String(id),
}));

export function speakerVoices(
  speakers: readonly string[],
  me: string | null,
  settingsVoice: number,
  chosen: ChosenVoices = {},
): Map<string, number> {
  const myVoice = me !== null && chosen[me] !== undefined ? chosen[me] : settingsVoice;
  const mine = VOICES.find((v) => v.id === myVoice);
  const used = new Set(mine ? [mine.character] : []);
  const voices = new Map<string, number>();
  if (me !== null) voices.set(me, myVoice);
  for (const speaker of speakers) {
    const id = chosen[speaker];
    if (id === undefined || voices.has(speaker)) continue;
    voices.set(speaker, id);
    const character = VOICES.find((v) => v.id === id)?.character;
    if (character) used.add(character);
  }
  let male = !(mine?.male ?? false);
  for (const speaker of speakers) {
    if (voices.has(speaker)) continue;
    const pick =
      VOICES.find((v) => v.male === male && !used.has(v.character)) ??
      VOICES.find((v) => !used.has(v.character));
    if (!pick) {
      voices.set(speaker, myVoice);
      continue;
    }
    voices.set(speaker, pick.id);
    used.add(pick.character);
    male = !male;
  }
  return voices;
}

const VOICE_IDS = new Set(VOICES.map((v) => v.id));

// The choice stored on a script, keeping only parts it still has: an edit may have renamed one.
export function readVoices(raw: string | null, speakers: readonly string[]): ChosenVoices {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([part, id]) => speakers.includes(part) && typeof id === 'number' && VOICE_IDS.has(id),
      ),
    ) as ChosenVoices;
  } catch {
    return {};
  }
}

// What is wrong with a choice to save, in the learner's words, or null.
export function checkVoices(
  voices: Record<string, unknown>,
  speakers: readonly string[],
): string | null {
  for (const [part, id] of Object.entries(voices)) {
    if (!speakers.includes(part)) return `Kịch bản không có vai "${part}".`;
    if (typeof id !== 'number' || !VOICE_IDS.has(id))
      return `Giọng cho vai "${part}" không có trong danh sách.`;
  }
  return null;
}
