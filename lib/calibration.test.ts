import { describe, expect, it } from 'vitest';
import {
  axesFor,
  DEAD_BAND,
  dynamicK,
  expectedSuccess,
  initialAbility,
  initialChallenge,
  MIN_OBSERVATIONS,
  proposeAdjustment,
  RATING_OUTCOME,
  RUNG_ORDER,
  successEstimate,
  SUPPORT_OFFSET,
  TARGET_SUCCESS,
  updateElo,
  type EloState,
  type Rung,
} from '@/lib/calibration';
import { DEFAULT_SETTINGS } from '@/lib/settings-schema';
import type { RatingValue } from '@/lib/srs';

const state = (patch: Partial<EloState> = {}): EloState => ({
  ability: 1200,
  challenge: 1200,
  abilityObservations: 0,
  challengeObservations: 0,
  ...patch,
});

describe('expectedSuccess', () => {
  it('equal ability and challenge is a coin flip', () => {
    expect(expectedSuccess(1200, 1200)).toBeCloseTo(0.5, 6);
  });

  it('+400 rating is ~10:1 odds (the Elo scale)', () => {
    expect(expectedSuccess(1600, 1200)).toBeCloseTo(10 / 11, 4);
    expect(expectedSuccess(1200, 1600)).toBeCloseTo(1 / 11, 4);
  });

  it('is monotonic in ability', () => {
    const easier = expectedSuccess(1300, 1200);
    const harder = expectedSuccess(1100, 1200);
    expect(easier).toBeGreaterThan(harder);
  });
});

describe('dynamicK', () => {
  it('starts high and decays with evidence (fast to find, then stable)', () => {
    const k0 = dynamicK(0);
    const k15 = dynamicK(15);
    const k200 = dynamicK(200);
    expect(k0).toBeGreaterThan(k15);
    expect(k15).toBeGreaterThan(k200);
    expect(k200).toBeGreaterThan(0);
  });

  it('a negative observation count cannot blow the rate up', () => {
    expect(dynamicK(-5)).toBe(dynamicK(0));
  });
});

describe('the rating sensor', () => {
  it('rating 3 (Good) is worth exactly the target, so 85% means "typically Good"', () => {
    expect(RATING_OUTCOME[3]).toBe(TARGET_SUCCESS);
  });

  it('is monotonic across the 4-point rubric', () => {
    const outcomes = ([1, 2, 3, 4] as RatingValue[]).map((r) => RATING_OUTCOME[r]);
    expect(outcomes).toEqual([...outcomes].sort((a, b) => a - b));
    expect(outcomes[0]).toBe(0);
    expect(outcomes[3]).toBe(1);
  });
});

describe('updateElo', () => {
  it('an unexpected success raises ability and LOWERS the item challenge by the same surprise', () => {
    const before = state({ ability: 1000, challenge: 1400 }); // a hard item
    const after = updateElo(before, 4, 'TRANSLATION');
    expect(after.ability).toBeGreaterThan(before.ability);
    expect(after.challenge).toBeLessThan(before.challenge);
    expect(after.ability - before.ability).toBeCloseTo(before.challenge - after.challenge, 6);
  });

  it('an expected failure barely moves anything', () => {
    const before = state({ ability: 1000, challenge: 1600 });
    const after = updateElo(before, 1, 'TRANSLATION');
    expect(Math.abs(after.ability - before.ability)).toBeLessThan(6);
  });

  it('converges toward the truth over a run of consistent outcomes', () => {
    let s = state({ ability: 1000, challenge: 1200 });
    for (let i = 0; i < 40; i += 1) {
      const next = updateElo(s, 4, 'TRANSLATION');
      s = {
        ability: next.ability,
        challenge: 1200, // hold the item fixed to isolate ability convergence
        abilityObservations: s.abilityObservations + 1,
        challengeObservations: s.challengeObservations + 1,
      };
    }
    expect(s.ability).toBeGreaterThan(1200);
    expect(expectedSuccess(s.ability, 1200)).toBeGreaterThan(0.85);
  });

  it('does not oscillate once settled (K has decayed)', () => {
    const settled = state({ ability: 1200, challenge: 1200, abilityObservations: 300 });
    const win = updateElo(settled, 4, 'TRANSLATION');
    const loss = updateElo(settled, 1, 'TRANSLATION');
    expect(Math.abs(win.ability - settled.ability)).toBeLessThan(20);
    expect(Math.abs(loss.ability - settled.ability)).toBeLessThan(20);
  });

  it('SUPPORT makes the same item easier, so a scaffolded win is weaker evidence', () => {
    const before = state({ ability: 1200, challenge: 1200 });
    const free = updateElo(before, 4, 'TRANSLATION');
    const scaffolded = updateElo(before, 4, 'CLOZE_PRODUCTION');
    expect(scaffolded.ability - before.ability).toBeLessThan(free.ability - before.ability);
    expect(SUPPORT_OFFSET.CLOZE_PRODUCTION).toBeLessThan(SUPPORT_OFFSET.GUIDED_PRODUCTION);
    expect(SUPPORT_OFFSET.GUIDED_PRODUCTION).toBeLessThan(SUPPORT_OFFSET.TRANSLATION);
    expect(SUPPORT_OFFSET.CONVERSATION).toBeGreaterThan(SUPPORT_OFFSET.TRANSLATION);
  });

  it('an unknown exerciseType is treated as unassisted rather than crashing', () => {
    const before = state();
    expect(updateElo(before, 3, 'SOMETHING_NEW').ability).toBe(
      updateElo(before, 3, 'TRANSLATION').ability,
    );
  });
});

describe('priors', () => {
  it('ability starts from what the LEARNER said they are studying (settings are the prior)', () => {
    expect(initialAbility({ grammarLevels: ['N5'] })).toBeLessThan(
      initialAbility({ grammarLevels: ['N3'] }),
    );
    expect(initialAbility({ grammarLevels: ['N5', 'N2'] })).toBe(
      initialAbility({ grammarLevels: ['N2'] }),
    );
  });

  it('item challenge starts from its JLPT level, and an unknown level is safe', () => {
    expect(initialChallenge('N1')).toBeGreaterThan(initialChallenge('N5'));
    expect(initialChallenge('nonsense')).toBe(initialChallenge('N5'));
  });
});

describe('axesFor', () => {
  it('reading Japanese is receptive, producing Japanese is productive', () => {
    expect(axesFor('JA_VI', 'TRANSLATION')).toEqual(['receptive']);
    expect(axesFor('VI_JA', 'TRANSLATION')).toEqual(['productive']);
  });

  it('the quiz is recognition (receptive) however the direction is set', () => {
    expect(axesFor('VI_JA', 'QUIZ')).toEqual(['receptive']);
  });

  it('both scaffolded rungs are production evidence', () => {
    expect(axesFor('VI_JA', 'CLOZE_PRODUCTION')).toEqual(['productive']);
    expect(axesFor('VI_JA', 'GUIDED_PRODUCTION')).toEqual(['productive']);
  });

  it('conversation is evidence for production AND register', () => {
    expect(axesFor('VI_JA', 'CONVERSATION')).toEqual(['productive', 'register']);
  });
});

describe('successEstimate', () => {
  it('thin history yields NO estimate rather than a confident-looking default', () => {
    expect(successEstimate([]).rate).toBe(null);
    expect(successEstimate([1, 1, 1]).rate).toBe(null);
    expect(successEstimate(Array(MIN_OBSERVATIONS - 1).fill(1)).rate).toBe(null);
  });

  it('starts reporting at the evidence floor', () => {
    const est = successEstimate(Array(MIN_OBSERVATIONS).fill(0.85));
    expect(est.rate).toBeCloseTo(0.85, 6);
    expect(est.observations).toBe(MIN_OBSERVATIONS);
  });

  it('is a ROLLING window — old turns fall out', () => {
    const outcomes = [...Array(40).fill(0), ...Array(20).fill(1)];
    expect(successEstimate(outcomes).rate).toBe(1);
  });
});

describe('proposeAdjustment', () => {
  const base = {
    axis: 'productive' as const,
    settings: { difficulty: DEFAULT_SETTINGS.difficulty },
    currentRung: 'TRANSLATION' as Rung,
    engagementFalling: false,
  };
  const est = (rate: number | null, observations = 20) => ({ rate, observations });

  it('says nothing without enough evidence', () => {
    expect(proposeAdjustment({ ...base, estimate: est(null, 3) })).toBe(null);
  });

  it('says nothing inside the dead band (no thrashing on noise)', () => {
    expect(proposeAdjustment({ ...base, estimate: est(TARGET_SUCCESS) })).toBe(null);
    expect(proposeAdjustment({ ...base, estimate: est(DEAD_BAND[0]) })).toBe(null);
    expect(proposeAdjustment({ ...base, estimate: est(DEAD_BAND[1]) })).toBe(null);
  });

  it('too hard on production → ADD a rung of support, not less exposure', () => {
    const p = proposeAdjustment({ ...base, estimate: est(0.4) });
    expect(p).toMatchObject({ target: 'rung', direction: 'down', to: 'GUIDED_PRODUCTION' });
    expect(p?.reason).toContain('khung');
  });

  it('too easy on production → REMOVE a rung of support', () => {
    const p = proposeAdjustment({
      ...base,
      currentRung: 'CLOZE_PRODUCTION',
      estimate: est(0.98),
    });
    expect(p).toMatchObject({ target: 'rung', direction: 'up', to: 'GUIDED_PRODUCTION' });
  });

  it('at the top of the ladder, too easy raises difficulty instead', () => {
    const p = proposeAdjustment({ ...base, estimate: est(0.98) });
    expect(p).toMatchObject({ target: 'difficulty', direction: 'up', from: 2, to: 3 });
  });

  it('at the bottom of the ladder, too hard lowers difficulty instead', () => {
    const p = proposeAdjustment({
      ...base,
      currentRung: 'CLOZE_PRODUCTION',
      estimate: est(0.3),
    });
    expect(p).toMatchObject({ target: 'difficulty', direction: 'down', from: 2, to: 1 });
  });

  it('never proposes past the ends of the difficulty scale', () => {
    expect(proposeAdjustment({ ...base, settings: { difficulty: 5 }, estimate: est(0.99) })).toBe(
      null,
    );
    expect(
      proposeAdjustment({
        ...base,
        currentRung: 'CLOZE_PRODUCTION',
        settings: { difficulty: 1 },
        estimate: est(0.1),
      }),
    ).toBe(null);
  });

  it('ENGAGEMENT VETO: never makes it harder while the learner is drifting away', () => {
    expect(proposeAdjustment({ ...base, estimate: est(0.98), engagementFalling: true })).toBe(null);
    expect(proposeAdjustment({ ...base, estimate: est(0.3), engagementFalling: true })).not.toBe(
      null,
    );
  });

  it('a receptive-axis problem never touches the production ladder', () => {
    const p = proposeAdjustment({ ...base, axis: 'receptive', estimate: est(0.3) });
    expect(p?.target).toBe('difficulty');
  });

  it('every proposal carries a learner-readable reason and its evidence', () => {
    for (const rate of [0.2, 0.5, 0.95, 0.99]) {
      const p = proposeAdjustment({ ...base, estimate: est(rate) });
      if (!p) continue;
      expect(p.reason.length).toBeGreaterThan(10);
      expect(p.reason).toContain(`${Math.round(rate * 100)}%`);
      expect(p.measured).toBe(rate);
      expect(p.axis).toBe('productive');
    }
  });

  it('proposes ONE step only — never a jump', () => {
    const p = proposeAdjustment({ ...base, currentRung: 'CLOZE_PRODUCTION', estimate: est(0.99) });
    const fromIndex = RUNG_ORDER.indexOf('CLOZE_PRODUCTION');
    const toIndex = RUNG_ORDER.indexOf(p?.to as Rung);
    expect(toIndex - fromIndex).toBe(1);
  });
});
