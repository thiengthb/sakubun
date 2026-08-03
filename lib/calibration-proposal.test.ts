// DB harness for the shadow-proposal history (plan 2026-07-26-adaptive-calibration, gate 1.4).
//
// The gate says a week of shadow proposals must be reviewed with the learner before Phase 3 may
// auto-apply anything — that is what makes the plan falsifiable. Until 2026-07-28 a proposal was
// computed per turn, rendered into the tool result, and then gone: `LearnerAbility` overwrites in
// place, so "review a week" meant scrolling a week of chat. These tests pin the three properties that
// make the gate answerable: the proposal SURVIVES the turn, it survives with the numbers it actually
// stood on, and the human's verdict is recorded rather than remembered.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-calprop-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Practice = typeof import('@/lib/practice');
type Db = typeof import('@/lib/db');

let P: Practice;
let prisma: Db['prisma'];

const NOW = new Date('2026-07-28T09:00:00Z');

let seq = 0;
async function freshUser(): Promise<string> {
  const id = `cp${seq++}`;
  await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
  return id;
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
    const user = await freshUser();
    await P.recordCalibrationProposal(user, shadow, 'sen-1', NOW);
    const [row] = await P.listCalibrationProposals(user);
    expect(row.target).toBe('difficulty');
    expect(row.direction).toBe('up');
    expect(row.axis).toBe('receptive');
    expect(row.measured).toBeCloseTo(0.91);
    expect(row.ability).toBeCloseTo(1395.2);
    expect(row.observations).toBe(30);
    expect(row.sentenceId).toBe('sen-1');
  });

  it('keeps the from/to values readable for BOTH shapes of setting', async () => {
    // `difficulty` is a number and `sentenceSize` a word. One stringified pair reads the same for
    // both; two nullable typed pairs would have to be kept in sync forever.
    const user = await freshUser();
    await P.recordCalibrationProposal(user, shadow, null, NOW);
    await P.recordCalibrationProposal(
      user,
      { ...shadow, target: 'sentenceSize', from: 'short', to: 'medium' },
      null,
      new Date(NOW.getTime() + 1000),
    );
    const rows = await P.listCalibrationProposals(user);
    expect(rows.map((r) => `${r.fromValue}->${r.toValue}`)).toEqual(['short->medium', '2->3']);
  });

  it('stores the learner-facing sentence VERBATIM', async () => {
    // The review judges what the learner actually heard. A reconstruction would be reviewing the
    // reviewer's memory of the wording, which is the thing this table exists to replace.
    const user = await freshUser();
    await P.recordCalibrationProposal(user, shadow, null, NOW);
    const [row] = await P.listCalibrationProposals(user);
    expect(row.reason).toBe(shadow.reason);
  });

  it('is APPEND-ONLY — a second proposal never overwrites the first', async () => {
    // This is the whole difference from `LearnerAbility`, which overwrites in place and is exactly
    // why nothing was reviewable before.
    const user = await freshUser();
    for (let i = 0; i < 3; i++) {
      await P.recordCalibrationProposal(
        user,
        { ...shadow, measured: 0.5 + i / 10 },
        null,
        new Date(NOW.getTime() + i * 1000),
      );
    }
    const rows = await P.listCalibrationProposals(user);
    expect(rows).toHaveLength(3);
    // Newest first, so a week's review starts at the most recent.
    expect(rows.map((r) => r.measured)).toEqual([0.7, 0.6, 0.5]);
  });
});

describe('the verdict is recorded, not remembered', () => {
  it('starts unreviewed and takes a verdict', async () => {
    const user = await freshUser();
    await P.recordCalibrationProposal(user, shadow, null, NOW);
    const [before] = await P.listCalibrationProposals(user);
    expect(before.verdict).toBeNull();
    expect(await P.setProposalVerdict(user, before.id, 'disagree')).toBe(true);
    const [after] = await P.listCalibrationProposals(user);
    expect(after.verdict).toBe('disagree');
  });

  it('refuses to let one member grade another member controller', async () => {
    const owner = await freshUser();
    const stranger = await freshUser();
    await P.recordCalibrationProposal(shadow, null, NOW);
    const [row] = await P.listCalibrationProposals();
    expect(await P.setProposalVerdict(stranger, row.id, 'agree')).toBe(false);
    const [unchanged] = await P.listCalibrationProposals();
    expect(unchanged.verdict).toBeNull();
  });
});

describe('tenancy', () => {
  it('never returns another member proposals', async () => {
    const a = await freshUser();
    const b = await freshUser();
    await P.recordCalibrationProposal(a, shadow, null, NOW);
    expect(await P.listCalibrationProposals(b)).toHaveLength(0);
  });
});
