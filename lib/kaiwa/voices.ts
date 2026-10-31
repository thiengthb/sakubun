import { VOICE_SPEAKERS } from '@/lib/settings/schema';

// A voice per speaker (K6b, docs/plans/2026-10-31-k6-kaiwa-listening.md): the learner's part keeps
// the voice chosen in Cài đặt, and every other part gets a voice of its own in the order it first
// speaks, a man's and a woman's in turn starting with the other kind, and never a character
// already speaking. The same script and the same choice always give the same voices. Pure.

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
  myVoice: number,
): Map<string, number> {
  const mine = VOICES.find((v) => v.id === myVoice);
  const used = new Set(mine ? [mine.character] : []);
  const voices = new Map<string, number>();
  if (me !== null) voices.set(me, myVoice);
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
