// Varied sentences for one item (R3, docs/plans/2026-11-07-translation-difficulty.md C): next_turn
// names a scene that turns with each sentence the item has had, and the last few sentences to stay
// away from; stage_turn refuses a sentence the item already had. Pure.

export const SCENES = [
  'daily life',
  'work',
  'school',
  'travel',
  'shopping',
  'friends',
  'news',
  'films and anime',
] as const;

/** How many earlier sentences next_turn shows, and how many stage_turn checks against. */
export const AVOID_SHOWN = 3;
export const AVOID_CHECKED = 10;

// The learner's own topics (Cài đặt) come first; without them, the fixed scenes.
export function sceneFor(sentencesSoFar: number, topics: readonly string[]): string {
  const scenes = topics.length > 0 ? topics : SCENES;
  return scenes[sentencesSoFar % scenes.length];
}

// The sentence without spaces or punctuation, so 「友達と、映画を見た。」 and 「友達と映画を見た」 match.
export function sentenceKey(ja: string): string {
  return ja.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '');
}

export function usedBefore(ja: string, earlier: readonly string[]): boolean {
  const key = sentenceKey(ja);
  return key.length > 0 && earlier.some((e) => sentenceKey(e) === key);
}
