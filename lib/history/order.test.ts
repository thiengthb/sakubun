import { describe, expect, it } from 'vitest';
import { matchesSearch, sortHistory } from './order';

const DAY = 86_400_000;
const at = (d: number) => new Date(Date.UTC(2026, 9, 1) + d * DAY);

function row(id: string, day: number, over: Partial<Parameters<typeof matchesSearch>[0]> = {}) {
  return {
    id,
    status: 'GRADED',
    score: null as number | null,
    rating: null as number | null,
    createdAt: at(day),
    sourceText: '',
    userAnswer: '',
    suggested: null as string | null,
    ...over,
  };
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('sortHistory', () => {
  const rows = [
    row('mid', 2, { score: 62 }),
    row('new-pending', 5, { status: 'PENDING' }),
    row('old-easy', 1, { rating: 4 }),
    row('new-again', 4, { rating: 1 }),
    row('skipped', 3, { status: 'SKIPPED' }),
  ];

  it('orders newest first by default and oldest first on request', () => {
    expect(ids(sortHistory(rows, 'recent'))).toEqual([
      'new-pending',
      'new-again',
      'skipped',
      'mid',
      'old-easy',
    ]);
    expect(ids(sortHistory(rows, 'oldest'))).toEqual([
      'old-easy',
      'mid',
      'skipped',
      'new-again',
      'new-pending',
    ]);
  });

  it('ranks grades and scores on one scale, and keeps turns with no result last both ways', () => {
    expect(ids(sortHistory(rows, 'best'))).toEqual([
      'old-easy',
      'mid',
      'new-again',
      'new-pending',
      'skipped',
    ]);
    expect(ids(sortHistory(rows, 'worst'))).toEqual([
      'new-again',
      'mid',
      'old-easy',
      'new-pending',
      'skipped',
    ]);
  });

  it('leaves its input alone', () => {
    const before = ids(rows);
    sortHistory(rows, 'oldest');
    expect(ids(rows)).toEqual(before);
  });
});

describe('matchesSearch', () => {
  const r = row('a', 0, {
    sourceText: '音楽を聞きながら',
    userAnswer: 'Tôi vừa nghe nhạc',
    suggested: 'Vừa nghe nhạc vừa học',
  });

  it('reads the prompt, the answer and the reference, ignoring case and edge spaces', () => {
    expect(matchesSearch(r, '聞き')).toBe(true);
    expect(matchesSearch(r, '  TÔI ')).toBe(true);
    expect(matchesSearch(r, 'vừa học')).toBe(true);
    expect(matchesSearch(r, 'mưa')).toBe(false);
  });

  it('an empty search matches everything, a missing reference matches nothing', () => {
    expect(matchesSearch(r, ' ')).toBe(true);
    expect(matchesSearch({ ...r, suggested: null }, 'vừa học')).toBe(false);
  });
});
