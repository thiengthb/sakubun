import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/test-db';

createTestDb('sakubun-calprop-');

type Practice = typeof import('@/lib/practice');
type Db = typeof import('@/lib/db');

let P: Practice;
let prisma: Db['prisma'];

const NOW = new Date('2026-07-28T09:00:00Z');

async function resetData(): Promise<void> {
  await resetLearningData(prisma);
}

const shadow = {
  target: 'difficulty' as const,
  direction: 'up' as const,
  from: 2,
  to: 3,
  reason: 'Bạn đang đúng gần hết, có thể nâng độ khó một bậc.',
  axis: 'receptive' as const,
  measured: 0.91,
  ability: 1395.2,
  observations: 30,
};

beforeAll(async () => {
  P = await import('@/lib/practice');
  ({ prisma } = await import('@/lib/db'));
});

describe('the proposal survives the turn', () => {
  it('records what was proposed, on which axis, with the numbers it stood on', async () => {
    await resetData();
    await P.recordCalibrationProposal(shadow, 'sen-1', NOW);
    const [row] = await P.listCalibrationProposals();
    expect(row.target).toBe('difficulty');
    expect(row.direction).toBe('up');
    expect(row.axis).toBe('receptive');
    expect(row.measured).toBeCloseTo(0.91);
    expect(row.ability).toBeCloseTo(1395.2);
    expect(row.observations).toBe(30);
    expect(row.sentenceId).toBe('sen-1');
  });

  it('keeps the from/to values readable for BOTH shapes of setting', async () => {
    await resetData();
    await P.recordCalibrationProposal(shadow, null, NOW);
    await P.recordCalibrationProposal(
      { ...shadow, target: 'sentenceSize', from: 'short', to: 'medium' },
      null,
      new Date(NOW.getTime() + 1000),
    );
    const rows = await P.listCalibrationProposals();
    expect(rows.map((r) => `${r.fromValue}->${r.toValue}`)).toEqual(['short->medium', '2->3']);
  });

  it('stores the learner-facing sentence VERBATIM', async () => {
    await resetData();
    await P.recordCalibrationProposal(shadow, null, NOW);
    const [row] = await P.listCalibrationProposals();
    expect(row.reason).toBe(shadow.reason);
  });

  it('is APPEND-ONLY — a second proposal never overwrites the first', async () => {
    await resetData();
    for (let i = 0; i < 3; i++) {
      await P.recordCalibrationProposal(
        { ...shadow, measured: 0.5 + i / 10 },
        null,
        new Date(NOW.getTime() + i * 1000),
      );
    }
    const rows = await P.listCalibrationProposals();
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.measured)).toEqual([0.7, 0.6, 0.5]);
  });
});

describe('the verdict is recorded, not remembered', () => {
  it('starts unreviewed and takes a verdict', async () => {
    await resetData();
    await P.recordCalibrationProposal(shadow, null, NOW);
    const [before] = await P.listCalibrationProposals();
    expect(before.verdict).toBeNull();
    expect(await P.setProposalVerdict(before.id, 'disagree')).toBe(true);
    const [after] = await P.listCalibrationProposals();
    expect(after.verdict).toBe('disagree');
  });

});
