// Listening to a whole script (K6c, docs/plans/2026-10-31-k6-kaiwa-listening.md): the lines play
// in order from the chosen one. With "Che câu của tôi" on, a covered line of the learner's first
// leaves a pause about as long as the sentence, so they say it themselves, then plays the model
// (thien, 2026-10-31). Pure: the page keeps the state and plays what it says.

export interface ListenState {
  index: number;
  /** 'gap': the learner's turn to speak; 'play': the line is playing. */
  phase: 'gap' | 'play';
  paused: boolean;
}

export function enterLine(index: number, covered: (i: number) => boolean): ListenState {
  return { index, phase: covered(index) ? 'gap' : 'play', paused: false };
}

// What comes once the current step is over; null at the end of the script.
export function nextStep(
  state: ListenState,
  lineCount: number,
  covered: (i: number) => boolean,
): ListenState | null {
  if (state.phase === 'gap') return { ...state, phase: 'play' };
  const next = state.index + 1;
  return next < lineCount ? enterLine(next, covered) : null;
}

// About how long the learner needs to say a sentence: a Japanese character takes about a fifth of
// a second at normal speed, plus a moment to start. Never under two seconds.
export function speakingPauseMs(japanese: string, rate = 1): number {
  const chars = [...japanese].filter((c) => !/[\s、。！？!?「」『』（）()・…]/u.test(c)).length;
  return Math.max(2000, Math.round((chars * 200) / Math.max(0.5, rate)) + 800);
}
