// The reading speeds offered in Settings. 0.5x is there for hearing each sound of a hard
// sentence; above 1.5x is too fast to be practice, so it is not offered.
export const SPEECH_RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;

// The segments to show: the presets, plus the saved rate when it is not one of them (a rate saved
// back when Settings had a 0.5x-2x slider), so the current choice is always visible and selected.
export function speechRateOptions(current: number): number[] {
  const presets: number[] = [...SPEECH_RATE_PRESETS];
  return presets.includes(current) ? presets : [...presets, current].sort((a, b) => a - b);
}
