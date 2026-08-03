import { describe, expect, it } from 'vitest';
import { fitItemCount } from '@/lib/fit-rows';

// The viewport-fit math is where a bug shows up as the exact symptom this feature fixes: too many rows
// -> the page scrolls and the pagination bar drops off screen. These pin the reserve (footer +
// bottomGap) is honoured, the grid multiplies by columns, and the min/max clamps hold.

describe('fitItemCount', () => {
  it('reserves the footer + bottomGap so rows never overrun the viewport', () => {
    // 1000 tall, rows start at 200, 60px footer, 40px bottomGap -> 700px for rows / 50px = 14 rows.
    expect(
      fitItemCount({
        viewportHeight: 1000,
        rowsTop: 200,
        footerHeight: 60,
        rowHeight: 50,
        bottomGap: 40,
        min: 1,
      }),
    ).toBe(14);
  });

  it('a TALLER footer leaves room for fewer rows (the whole-layout fix)', () => {
    const base = {
      viewportHeight: 1000,
      rowsTop: 200,
      rowHeight: 50,
      bottomGap: 40,
      min: 1,
    } as const;
    const short = fitItemCount({ ...base, footerHeight: 40 });
    const wrapped = fitItemCount({ ...base, footerHeight: 120 }); // footer wrapped to 2 lines
    expect(wrapped).toBeLessThan(short);
  });

  it('multiplies rows by the grid column count', () => {
    // 700px / 100px pitch = 7 rows; 3 columns -> 21 items.
    expect(
      fitItemCount({
        viewportHeight: 1000,
        rowsTop: 200,
        footerHeight: 60,
        rowHeight: 100,
        bottomGap: 40,
        itemsPerRow: 3,
        min: 1,
        max: 100,
      }),
    ).toBe(21);
  });

  it('clamps to at least `min` even when nothing fits', () => {
    expect(
      fitItemCount({
        viewportHeight: 300,
        rowsTop: 290,
        footerHeight: 60,
        rowHeight: 50,
        min: 5,
      }),
    ).toBe(5);
  });

  it('clamps to `max`', () => {
    expect(
      fitItemCount({
        viewportHeight: 100000,
        rowsTop: 0,
        footerHeight: 0,
        rowHeight: 10,
        max: 100,
      }),
    ).toBe(100);
  });

  it('never divides by a zero pitch', () => {
    expect(() =>
      fitItemCount({ viewportHeight: 800, rowsTop: 100, footerHeight: 50, rowHeight: 0 }),
    ).not.toThrow();
  });
});
