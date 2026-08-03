import { describe, expect, it } from 'vitest';
import { LOOP_STEPS } from '@/components/shared/loop-steps';
import { HOW_STEPS } from '@/components/guide/guide-steps';

/**
 * Anti-drift gate for the app's core loop (plan 2026-07-25, phase F3). The five steps of one practice turn
 * are told on TWO surfaces — the public landing ("Cách hoạt động") and the `/guide` walkthrough — and each
 * used to hard-code its own copy of the titles. A renamed step then silently disagreed with the page
 * selling the product.
 *
 * `guide-steps.tsx` now takes each title from `LOOP_STEPS`, so today they cannot diverge by construction;
 * this test is what makes that STAY true (a future edit that re-hard-codes a title turns red here).
 */
describe('loop steps (single source)', () => {
  it('describes exactly five steps, each with a title and landing copy', () => {
    expect(LOOP_STEPS).toHaveLength(5);
    expect(LOOP_STEPS.filter((s) => s.title.trim().length < 5)).toEqual([]);
    expect(LOOP_STEPS.filter((s) => s.landingBody == null)).toEqual([]);
  });

  it('the /guide walkthrough uses the same titles, in the same order', () => {
    expect(HOW_STEPS.map((s) => s.title)).toEqual(LOOP_STEPS.map((s) => s.title));
  });

  it('every guide step still carries its own body + illustration', () => {
    // The shared module owns TITLES only — the guide teaches with its own longer body and a mockup.
    expect(HOW_STEPS.filter((s) => s.body == null || s.visual == null)).toEqual([]);
  });
});
