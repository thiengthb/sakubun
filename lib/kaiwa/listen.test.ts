import { describe, expect, it } from 'vitest';
import { enterLine, nextStep, speakingPauseMs } from '@/lib/kaiwa/listen';

describe('whole-script listening', () => {
  const none = () => false;
  const second = (i: number) => i === 1;

  it('plays each line in order and stops after the last', () => {
    let state = enterLine(0, none);
    expect(state).toEqual({ index: 0, phase: 'play', paused: false });
    state = nextStep(state, 3, none)!;
    expect(state.index).toBe(1);
    state = nextStep(state, 3, none)!;
    expect(nextStep(state, 3, none)).toBeNull();
  });

  it('leaves the learner a pause on a covered line, then plays the model', () => {
    let state = nextStep(enterLine(0, second), 3, second)!;
    expect(state).toEqual({ index: 1, phase: 'gap', paused: false });
    state = nextStep(state, 3, second)!;
    expect(state).toEqual({ index: 1, phase: 'play', paused: false });
    expect(nextStep(state, 3, second)).toEqual({ index: 2, phase: 'play', paused: false });
  });

  it('starts on a covered line with the pause', () => {
    expect(enterLine(1, second).phase).toBe('gap');
  });
});

describe('speakingPauseMs', () => {
  it('grows with the sentence, not its punctuation, and is longer when speech is slow', () => {
    expect(speakingPauseMs('はい。')).toBe(2000);
    const long = speakingPauseMs('来月のシフトのことなんですが……。');
    expect(long).toBe(14 * 200 + 800);
    expect(speakingPauseMs('来月のシフトのことなんですが……。', 0.5)).toBe(14 * 400 + 800);
  });
});
