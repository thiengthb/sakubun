import { describe, expect, it } from 'vitest';
import { stepTextSize, textScale, textSizeLabel, TEXT_SIZES } from '@/lib/kaiwa/text-size';

describe('text size', () => {
  it('steps up and down within the sizes', () => {
    expect(stepTextSize(0, 1)).toBe(1);
    expect(stepTextSize(2, -1)).toBe(1);
    expect(stepTextSize(0, -1)).toBe(0);
    expect(stepTextSize(TEXT_SIZES.length - 1, 1)).toBe(TEXT_SIZES.length - 1);
  });

  it('reads a stored value that is out of range or broken as the nearest size', () => {
    expect(textScale(0)).toBe(1);
    expect(textScale(99)).toBe(1.75);
    expect(textScale(-3)).toBe(1);
    expect(textScale(Number.NaN)).toBe(1);
    expect(stepTextSize(Number.NaN, 1)).toBe(1);
  });

  it('labels the size in percent', () => {
    expect(textSizeLabel(2)).toBe('130%');
  });
});
