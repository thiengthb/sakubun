import { describe, expect, it } from 'vitest';
import {
  checkStage,
  finalRating,
  MAX_SENTENCE_CHARS,
  nextTurnStatus,
  parseRating,
  patternAppears,
} from '@/lib/domain/turn';

describe('nextTurnStatus', () => {
  it('a staged turn is graded once or skipped once', () => {
    expect(nextTurnStatus('staged', { type: 'grade', rating: 3 })).toEqual({
      ok: true,
      data: 'graded',
    });
    expect(nextTurnStatus('staged', { type: 'skip' })).toEqual({ ok: true, data: 'skipped' });
  });

  it('a finished turn refuses any further event and names the fix', () => {
    for (const status of ['graded', 'skipped'] as const) {
      for (const event of [{ type: 'grade', rating: 3 } as const, { type: 'skip' } as const]) {
        const result = nextTurnStatus(status, event);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain('next_turn');
      }
    }
  });
});

describe('parseRating', () => {
  it('accepts 1 to 4', () => {
    for (const r of [1, 2, 3, 4]) expect(parseRating(r)).toEqual({ ok: true, data: r });
  });

  it('refuses anything else with a short fix', () => {
    for (const bad of [0, 5, 2.5, '3', null, undefined]) {
      const result = parseRating(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/1, 2, 3 or 4/);
    }
  });
});

describe('finalRating', () => {
  it('turns Easy into Good once the learner needed a hint, and leaves the rest', () => {
    expect(finalRating(4, true)).toBe(3);
    expect(finalRating(4, false)).toBe(4);
    expect(finalRating(2, true)).toBe(2);
  });
});

describe('patternAppears', () => {
  const cases: [string, string, boolean][] = [
    ['〜ばかりに', 'ちょっと遅れたばかりに、電車に乗れなかった。', true],
    ['〜ことにする', '毎朝歩くことにした。', true],
    ['〜はずがない', 'あの人がうそをつくはずがなかった。', true],
    ['〜ざるを得ない', '計画を縮小せざるを得ない。', true],
    ['〜に比べて', '去年に比べて涼しい。', true],
    ['〜べきだ / 〜べきではない', 'すぐに謝るべきではない。', true],
    ['〜ても / 〜でも', '雨が降っても行きます。', true],
    ['たとえ〜ても', 'たとえ反対されても諦めない。', true],
    ['たとえ〜ても', '反対されてもたとえ諦めない。', false],
    ['〜にする（decide）', '私はカレーにします。', true],
    ['〜ばかりに', '遅れたせいで乗れなかった。', false],
    ['〜ざるを得ない', '計画を縮小するしかない。', false],
    // Polite forms of patterns ending in ない.
    ['〜てはいけない', 'ここでたばこを吸ってはいけません。', true],
    ['〜なければならない', '明日は早く起きなければなりません。', true],
    ['〜わけにはいかない', '今日は休むわけにはいきません。', true],
    ['〜はずがない', 'そんなことがあるはずがありません。', true],
    // A form that would shrink to one kana must not match anything that has that kana.
    ['〜ない', '雨なのに出かけた。', false],
    ['〜たい', '昨日映画を見た。', false],
    ['〜たい', '今日はどこにも行きたくない。', true],
    ['〜たい', '子どものころ、先生になりたかった。', true],
    ['〜まい', '毎朝運動します。', false],
    ['〜くない / 〜かった / 〜くなかった', 'この部屋はあまり広くないです。', true],
    ['〜てくる', 'ちょっとコンビニに行ってきます。', true],
    ['〜てならない', '故郷の母のことが心配でならない。', true],
    ['〜ことに（は）', '驚いたことに、彼は会社を辞めた。', true],
    ['あまり〜ない', '私はあまりテレビを見ません。', true],
    ['お〜する', '重そうですね。お持ちしましょうか。', true],
  ];
  it.each(cases)('%s in %s → %s', (expression, ja, expected) => {
    expect(patternAppears(expression, ja)).toBe(expected);
  });
});

describe('checkStage', () => {
  const grammar = { kind: 'GRAMMAR' as const, expression: '〜ばかりに', reading: null };
  const draft = {
    ja: '少し遅れたばかりに、電車に乗れなかった。',
    jaRuby: null,
    vi: 'Chỉ vì trễ một chút mà không lên được tàu.',
    hint: null,
    uses: null,
  };

  it('accepts a sentence that uses the target within the length window', () => {
    expect(checkStage(draft, grammar, [16, 28])).toEqual({ ok: true, data: undefined });
  });

  it('refuses a sentence far outside the window and names the window', () => {
    const result = checkStage(draft, grammar, [8, 10]);
    expect(result).toEqual({
      ok: false,
      error: 'ja is 18 characters; write 8-10, then call stage_turn again.',
    });
  });

  it('lets a spoken hint lift the window but keeps the hard ceiling', () => {
    expect(checkStage({ ...draft, hint: 'câu ngắn hơn' }, grammar, [26, 42]).ok).toBe(true);
    const long = { ...draft, ja: 'ばかりに' + 'あ'.repeat(MAX_SENTENCE_CHARS), hint: 'dài' };
    expect(checkStage(long, grammar, [26, 42]).ok).toBe(false);
  });

  it('refuses a sentence without the target', () => {
    const result = checkStage(
      { ...draft, ja: '少し遅れたせいで、電車に乗れなかった。' },
      grammar,
      [16, 28],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('does not use 〜ばかりに');
  });

  it('accepts an irregular form the learner names with uses, copied from ja', () => {
    const honorific = { kind: 'GRAMMAR' as const, expression: '尊敬語', reading: null };
    const ja = '社長は何時ごろいらっしゃいますか。';
    expect(checkStage({ ...draft, ja }, honorific, [12, 22]).ok).toBe(false);
    expect(checkStage({ ...draft, ja, uses: 'いらっしゃいます' }, honorific, [12, 22]).ok).toBe(
      true,
    );
    expect(checkStage({ ...draft, ja, uses: 'おっしゃる' }, honorific, [12, 22])).toEqual({
      ok: false,
      error: 'uses must be two or more characters copied exactly from ja.',
    });
  });

  it('finds a conjugated vocabulary word', () => {
    const vocab = { kind: 'VOCAB' as const, expression: '急ぐ', reading: 'いそぐ' };
    const ja = '時間がないので急いで駅へ行きました。';
    expect(checkStage({ ...draft, ja }, vocab, [12, 22]).ok).toBe(true);
  });

  it('refuses ruby that does not spell the sentence', () => {
    const ok = {
      ...draft,
      jaRuby: '少[すこ]し遅[おく]れたばかりに、電車[でんしゃ]に乗[の]れなかった。',
    };
    expect(checkStage(ok, grammar, [16, 28]).ok).toBe(true);
    const bad = { ...draft, jaRuby: '遅[おく]れたばかりに' };
    expect(checkStage(bad, grammar, [16, 28])).toEqual({
      ok: false,
      error: 'jaRuby must spell ja exactly. Fix it or leave jaRuby out.',
    });
  });
});
