// Pure arithmetic behind the settings stepper (components/common/stepper.tsx). The bounds come from
// settingsSchema, so a value the stepper produces always passes the save-time validation.

export interface StepperBounds {
  min: number;
  max: number;
}

export function clampToBounds(value: number, { min, max }: StepperBounds): number {
  return Math.min(max, Math.max(min, value));
}

export function stepValue(value: number, delta: number, bounds: StepperBounds): number {
  return clampToBounds(value + delta, bounds);
}

// What the learner typed into the stepper's box. A partial entry ("", "1" on the way to "100" when
// min is 10) is not an error, it is just not a value yet: return null and leave the setting alone.
export function parseStepperInput(raw: string, { min, max }: StepperBounds): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}
