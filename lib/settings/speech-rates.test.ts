import { describe, expect, it } from 'vitest';
import { SPEECH_RATE_PRESETS, speechRateOptions } from './speech-rates';

describe('speechRateOptions', () => {
  it('offers five speeds from 0.5x to 1.5x', () => {
    expect([...SPEECH_RATE_PRESETS]).toEqual([0.5, 0.75, 1, 1.25, 1.5]);
    expect(speechRateOptions(1)).toEqual([0.5, 0.75, 1, 1.25, 1.5]);
  });

  it('keeps a saved speed that is no longer a preset, in order', () => {
    expect(speechRateOptions(2)).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
    expect(speechRateOptions(1.75)).toEqual([0.5, 0.75, 1, 1.25, 1.5, 1.75]);
  });

  it('does not mutate the presets', () => {
    speechRateOptions(2);
    expect(SPEECH_RATE_PRESETS).toHaveLength(5);
  });
});
