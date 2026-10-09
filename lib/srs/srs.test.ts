import { describe, expect, it } from 'vitest';
import { forgettingCurve, newSrsFields, rateOnce, retrievability } from '@/lib/srs/srs';

const RETENTION = { retention: 0.9 };
const NOW = new Date('2026-07-06T10:00:00Z');

describe('newSrsFields', () => {
  it('creates a New card due immediately', () => {
    const fields = newSrsFields(NOW);
    expect(fields.state).toBe(0);
    expect(fields.reps).toBe(0);
    expect(fields.lapses).toBe(0);
    expect(fields.due.getTime()).toBe(NOW.getTime());
    expect(fields.lastReview).toBeNull();
  });
});

describe('rateOnce', () => {
  it('Good on a new card schedules it into the future and increments reps', () => {
    const { next, log } = rateOnce(newSrsFields(NOW), 3, { ...RETENTION, now: NOW });
    expect(next.reps).toBe(1);
    expect(next.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.lastReview?.getTime()).toBe(NOW.getTime());
    expect(log.state).toBe(0); // first-ever review happened while the card was New
    expect(log.rating).toBe(3);
    expect(log.due.getTime()).toBe(next.due.getTime());
  });

  it('Easy schedules further out than Again', () => {
    const base = newSrsFields(NOW);
    const again = rateOnce(base, 1, { ...RETENTION, now: NOW });
    const easy = rateOnce(base, 4, { ...RETENTION, now: NOW });
    expect(easy.next.due.getTime()).toBeGreaterThan(again.next.due.getTime());
  });

  it('Again on a mature Review card counts a lapse', () => {
    const graduated = rateOnce(newSrsFields(NOW), 4, { ...RETENTION, now: NOW }).next;
    expect(graduated.state).toBe(2); // Review
    const later = new Date(graduated.due.getTime() + 24 * 3600 * 1000);
    const lapsed = rateOnce(graduated, 1, { ...RETENTION, now: later });
    expect(lapsed.next.lapses).toBe(graduated.lapses + 1);
    expect(lapsed.next.state).toBe(3); // Relearning
  });

  it('higher desired retention gives shorter intervals', () => {
    const graduated = rateOnce(newSrsFields(NOW), 4, { ...RETENTION, now: NOW }).next;
    const later = new Date(graduated.due.getTime());
    const relaxed = rateOnce(graduated, 3, { retention: 0.8, now: later });
    const strict = rateOnce(graduated, 3, { retention: 0.95, now: later });
    expect(strict.next.due.getTime()).toBeLessThan(relaxed.next.due.getTime());
  });
});

describe('retrievability', () => {
  it('is null for a never-reviewed (New) card', () => {
    expect(retrievability(newSrsFields(NOW), { ...RETENTION, now: NOW })).toBeNull();
  });

  it('is ~1 right after a review and decays over time', () => {
    const graduated = rateOnce(newSrsFields(NOW), 4, { ...RETENTION, now: NOW }).next;
    const justAfter = retrievability(graduated, { ...RETENTION, now: NOW })!;
    const wayLater = retrievability(graduated, {
      ...RETENTION,
      now: new Date(NOW.getTime() + 365 * 86_400_000),
    })!;
    expect(justAfter).toBeGreaterThan(0.98);
    expect(justAfter).toBeLessThanOrEqual(1);
    expect(wayLater).toBeLessThan(justAfter);
  });
});

describe('forgettingCurve', () => {
  it('is empty for a never-reviewed card', () => {
    expect(forgettingCurve(newSrsFields(NOW), RETENTION)).toEqual([]);
  });

  it('starts near 1 and is monotonically non-increasing', () => {
    const graduated = rateOnce(newSrsFields(NOW), 4, { ...RETENTION, now: NOW }).next;
    const curve = forgettingCurve(graduated, { ...RETENTION, samples: 12 });
    expect(curve).toHaveLength(13);
    expect(curve[0].day).toBe(0);
    expect(curve[0].r).toBeGreaterThan(0.98);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].r).toBeLessThanOrEqual(curve[i - 1].r + 1e-9);
      expect(curve[i].day).toBeGreaterThan(curve[i - 1].day);
    }
  });
});
