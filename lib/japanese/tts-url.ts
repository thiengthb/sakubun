// The address one reading is fetched from (/api/tts): the speaker button plays it, and Hội thoại's
// whole-script listening (K6c) asks for the next lines early so the server has them ready. Both
// must build it the same way, or the early fetch warms a different file. Pure.
export function ttsUrl(text: string, speaker?: number, rate = 1): string {
  const speakerParam = speaker != null ? `&speaker=${speaker}` : '';
  const rateParam = rate !== 1 ? `&rate=${rate}` : '';
  return `/api/tts?text=${encodeURIComponent(text)}${speakerParam}${rateParam}`;
}

// Where a reading's mora timing comes from (Kaiwa b): the same sentence and voice, any speed.
export function ttsTimingUrl(text: string, speaker?: number): string {
  return `${ttsUrl(text, speaker)}&timing=1`;
}
