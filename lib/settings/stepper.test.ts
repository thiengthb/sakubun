import { describe, expect, it } from 'vitest';
import { clampToBounds, parseStepperInput, stepValue } from '@/lib/settings/stepper';

const REVIEWS = { min: 10, max: 500 };

describe('settings stepper', () => {
  it('steps by the given amount inside the bounds', () => {
    expect(stepValue(100, 10, REVIEWS)).toBe(110);
    expect(stepValue(100, -10, REVIEWS)).toBe(90);
  });

  it('never steps past either bound', () => {
    expect(stepValue(15, -10, REVIEWS)).toBe(10);
    expect(stepValue(495, 10, REVIEWS)).toBe(500);
    expect(clampToBounds(-3, { min: 0, max: 6 })).toBe(0);
  });

  it('accepts a typed whole number inside the bounds', () => {
    expect(parseStepperInput('120', REVIEWS)).toBe(120);
    expect(parseStepperInput(' 11 ', { min: 0, max: 20 })).toBe(11);
  });

  it('treats a partial or out-of-range entry as no value yet', () => {
    expect(parseStepperInput('', REVIEWS)).toBeNull();
    expect(parseStepperInput('1', REVIEWS)).toBeNull();
    expect(parseStepperInput('900', REVIEWS)).toBeNull();
    expect(parseStepperInput('1.5', REVIEWS)).toBeNull();
    expect(parseStepperInput('-5', { min: 0, max: 20 })).toBeNull();
  });
});
