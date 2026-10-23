import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';
import type { TurnHistorySource } from '@/lib/app/history';

createTestDb('sakubun-app-history-');

type History = typeof import('@/lib/app/history');
type Db = typeof import('@/lib/db/db');
let H: History;
let prisma: Db['prisma'];

const TURN: TurnHistorySource = {
  id: 't1',
  direction: 'JA_VI',
  ja: '急いで駅へ行きました。',
  jaRuby: '急[いそ]いで駅[えき]へ行[い]きました。',
  vi: 'Tôi vội đi ra ga.',
  status: 'graded',
  answer: 'Tôi vội ra ga.',
  rating: 3,
  feedback: 'Tốt.',
  createdAt: new Date('2030-01-15T03:00:00.000Z'),
  gradedAt: new Date('2030-01-15T03:01:00.000Z'),
  item: { expression: '急ぐ', level: 'N4' },
};

beforeAll(async () => {
  H = await import('@/lib/app/history');
  ({ prisma } = await import('@/lib/db/db'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('turnToRow', () => {
  it('shows the Japanese as the prompt for JA_VI, with its grade as the one rating', () => {
    expect(H.turnToRow(TURN)).toMatchObject({
      kind: 'turn',
      status: 'GRADED',
      sourceText: TURN.ja,
      sourceRuby: TURN.jaRuby,
      suggested: TURN.vi,
      suggestedRuby: null,
      userAnswer: 'Tôi vội ra ga.',
      score: null,
      rating: 3,
      level: 'N4',
      answeredAt: TURN.gradedAt,
      ratings: [{ expression: '急ぐ', rating: 3, role: 'TARGET' }],
    });
  });

  it('shows the Vietnamese as the prompt for VI_JA, and the Japanese as the reference', () => {
    const row = H.turnToRow({ ...TURN, direction: 'VI_JA' });
    expect(row).toMatchObject({ sourceText: TURN.vi, sourceRuby: null, suggested: TURN.ja });
    expect(row.suggestedRuby).toBe(TURN.jaRuby);
  });

  it('maps a staged or skipped turn to the sentence statuses, with no rating', () => {
    const staged = H.turnToRow({ ...TURN, status: 'staged', answer: null, rating: null });
    expect(staged).toMatchObject({ status: 'PENDING', userAnswer: '', ratings: [] });
    expect(H.turnToRow({ ...TURN, status: 'skipped', rating: null }).status).toBe('SKIPPED');
    expect(H.turnToRow({ ...TURN, item: null }).ratings[0].expression).toBe('(đã xóa)');
  });
});

describe('listHistory', () => {
  it('lists old sentences and new turns in one timeline, newest first', async () => {
    await prisma.sentence.create({
      data: {
        id: 's-old',
        direction: 'JA_VI',
        sourceText: '古い文です。',
        userAnswer: 'Câu cũ.',
        status: 'GRADED',
        createdAt: new Date('2030-01-14T00:00:00.000Z'),
      },
    });
    await prisma.turn.create({
      data: {
        id: 't-new',
        direction: 'JA_VI',
        ja: TURN.ja,
        vi: TURN.vi,
        status: 'graded',
        rating: 3,
        createdAt: new Date('2030-01-15T00:00:00.000Z'),
      },
    });

    const rows = await H.listHistory();
    expect(rows.map((r) => [r.id, r.kind])).toEqual([
      ['t-new', 'turn'],
      ['s-old', 'sentence'],
    ]);
    expect(rows[1].rating).toBeNull();
  });
});
