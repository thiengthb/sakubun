import { describe, expect, it } from 'vitest';
import { levelSets, type SetEntry, type SetItem } from './level-sets';
import { leadActions, setAction, setSummary } from './level-screen';

const NOW = new Date('2026-11-18T12:00:00Z');
const PAST = new Date('2026-11-17T12:00:00Z');
const FUTURE = new Date('2026-11-25T12:00:00Z');

const entries = (n: number): SetEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    expression: `w${i + 1}`,
    reading: null,
    hanviet: null,
    meaningVi: null,
  }));
const item = (expression: string, over: Partial<SetItem> = {}): SetItem => ({
  id: `id-${expression}`,
  expression,
  suspended: false,
  state: 2,
  due: FUTURE,
  lapses: 0,
  ...over,
});
const N5_VOCAB = { level: 'N5', kind: 'vocab', studyLevel: 'N5' } as const;

describe('leadActions', () => {
  it('sends new words to Ôn nhanh when the level is the one being studied', () => {
    const sets = levelSets(
      entries(25),
      [item('w1', { due: PAST }), ...['w21', 'w22'].map((e) => item(e, { state: 0 }))],
      NOW,
    );
    const lead = leadActions(sets, N5_VOCAB);
    expect(lead.main).toMatchObject({ label: 'Học tiếp', count: 2, href: '/review' });
    expect(lead.main.hint).toContain('Chặng 2 còn 2 từ chưa học');
    expect(lead.due).toMatchObject({ count: 1, href: '/review' });
    expect(lead.take).toMatchObject({
      count: 22,
      href: '/library?tab=items&type=VOCAB&level=N5',
    });
  });

  it('points to Cài đặt when Ôn nhanh takes new items from another level', () => {
    const sets = levelSets(entries(3), [item('w1', { state: 0 })], NOW);
    const lead = leadActions(sets, { level: 'N4', kind: 'grammar', studyLevel: 'N5' });
    expect(lead.main).toMatchObject({ label: 'Học cấp này', href: '/settings?tab=practice' });
    expect(lead.main.hint).toContain('mẫu mới từ N5');
  });

  it('offers the first set still to take once every taken word is studied', () => {
    const sets = levelSets(
      entries(30),
      entries(22).map((e) => item(e.expression)),
      NOW,
    );
    expect(leadActions(sets, N5_VOCAB).main).toMatchObject({ label: 'Lấy chặng 2', count: 8 });
  });

  it('has nothing to do on a level taken and studied in full', () => {
    const sets = levelSets(entries(2), [item('w1'), item('w2')], NOW);
    const lead = leadActions(sets, N5_VOCAB);
    expect(lead.main).toMatchObject({ label: 'Đủ cả cấp', href: null });
    expect(lead.due.href).toBeNull();
    expect(lead.take).toMatchObject({ count: 0, href: null, hint: 'đã có đủ cả cấp' });
  });
});

describe('setAction', () => {
  const ctx = { level: 'N5', kind: 'vocab' } as const;
  it('reviews what is due first, then takes what is missing, then says all is learnt', () => {
    const [due] = levelSets(entries(2), [item('w1', { due: PAST })], NOW).sets;
    expect(setAction(due!, ctx)).toMatchObject({ label: 'Ôn 1', href: '/review' });
    const [missing] = levelSets(entries(2), [item('w1')], NOW).sets;
    expect(setAction(missing!, ctx)).toMatchObject({ label: 'Lấy 1' });
    const [done] = levelSets(entries(1), [item('w1')], NOW).sets;
    expect(setAction(done!, ctx)).toMatchObject({ label: 'Thuộc hết', href: null });
    const [learning] = levelSets(entries(1), [item('w1', { state: 1 })], NOW).sets;
    expect(setAction(learning!, ctx)).toBeNull();
  });
});

describe('setSummary', () => {
  it('names only the states the set has', () => {
    expect(setSummary({ mastered: 18, due: 1, learning: 1, new: 0, none: 0, paused: 0 })).toBe(
      '18 thuộc · 1 đến hạn · 1 đang học',
    );
    expect(setSummary({ mastered: 0, due: 0, learning: 0, new: 0, none: 20, paused: 0 })).toBe(
      '20 chưa có',
    );
  });
});
