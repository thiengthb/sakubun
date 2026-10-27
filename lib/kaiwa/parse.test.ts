import { describe, expect, it } from 'vitest';
import {
  checkScript,
  describeProblems,
  normalizeBody,
  parseScript,
  plainJapanese,
  SCRIPT_LIMITS,
  speakerLabel,
} from '@/lib/kaiwa/parse';

describe('parseScript', () => {
  it('reads dialogue, monologue and lines without a translation', () => {
    expect(
      parseScript(
        ['A: こんにちは。 | Xin chào.', '', '今日は暑い。 | Hôm nay nóng.', 'B: そうですね。'].join(
          '\n',
        ),
      ),
    ).toEqual([
      { speaker: 'A', japanese: 'こんにちは。', translation: 'Xin chào.', row: 1 },
      { speaker: null, japanese: '今日は暑い。', translation: 'Hôm nay nóng.', row: 3 },
      { speaker: 'B', japanese: 'そうですね。', translation: '', row: 4 },
    ]);
  });

  it('reads the old Markdown style the kaiwa-canvas sample used', () => {
    const raw = [
      '**C:** はい、いかがなさいましたか。',
      '**Tiếng Việt:** Vâng ạ, có vấn đề gì ạ?',
      '',
      '**B:** 玉ねぎが入っています。',
      '**Romaji:** tamanegi ga haitte imasu.',
      '**Tiếng Việt:** Trong món vẫn có hành ạ.',
    ].join('\n');
    expect(parseScript(raw)).toEqual([
      {
        speaker: 'C',
        japanese: 'はい、いかがなさいましたか。',
        translation: 'Vâng ạ, có vấn đề gì ạ?',
        row: 1,
      },
      {
        speaker: 'B',
        japanese: '玉ねぎが入っています。',
        translation: 'Trong món vẫn có hành ạ.',
        row: 4,
      },
    ]);
  });

  it('accepts the full-width colon and bar an AI often writes', () => {
    expect(parseScript('A：駅はどこですか。｜Nhà ga ở đâu?')).toEqual([
      { speaker: 'A', japanese: '駅はどこですか。', translation: 'Nhà ga ở đâu?', row: 1 },
    ]);
  });

  it('does not take a time or a number for a speaker', () => {
    expect(parseScript('10:30に会いましょう。 | Gặp lúc 10:30 nhé.')).toEqual([
      {
        speaker: null,
        japanese: '10:30に会いましょう。',
        translation: 'Gặp lúc 10:30 nhé.',
        row: 1,
      },
    ]);
  });

  it('keeps manual furigana in the Japanese for the view to read', () => {
    expect(parseScript('A: 料理[りょうり]です。 | Là món ăn.')[0].japanese).toBe(
      '料理[りょうり]です。',
    );
  });
});

describe('speakerLabel', () => {
  it('shortens Latin names to two letters and keeps Japanese names', () => {
    expect(speakerLabel('a')).toBe('A');
    expect(speakerLabel('An')).toBe('An');
    expect(speakerLabel('tanaka')).toBe('Ta');
    expect(speakerLabel('田中')).toBe('田中');
    expect(speakerLabel('10')).toBeNull();
  });
});

describe('checkScript', () => {
  it('passes a well-formed script', () => {
    expect(checkScript('Ở nhà hàng', 'A: いらっしゃいませ。 | Xin mời vào.')).toEqual([]);
  });

  it('refuses a missing title and an empty body', () => {
    expect(checkScript('  ', '\n\n').map((p) => p.message)).toEqual([
      'Thiếu tiêu đề. Đặt một tiêu đề ngắn.',
      'Kịch bản trống. Thêm ít nhất một dòng dạng "A: 日本語 | tiếng Việt".',
    ]);
  });

  it('points at a row with no Japanese, such as a heading an AI added', () => {
    const problems = checkScript(
      'Hội thoại',
      '# Hội thoại ở ga\nA: 駅はどこですか。 | Nhà ga ở đâu?',
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].row).toBe(1);
  });

  it('points at furigana that is not right after a kanji', () => {
    const problems = checkScript('T', 'A: すし[寿司]をたべます。 | Ăn sushi.');
    expect(problems).toEqual([{ row: 1, message: expect.stringContaining('Furigana sai chỗ') }]);
  });

  it('refuses scripts past the limits', () => {
    const long = Array.from({ length: SCRIPT_LIMITS.lines + 1 }, () => 'A: はい。').join('\n');
    expect(describeProblems(checkScript('T', long))).toContain('hơn 300 dòng');
    expect(describeProblems(checkScript('x'.repeat(81), 'A: はい。'))).toContain('Tiêu đề dài');
    expect(describeProblems(checkScript('T', `A: ${'あ'.repeat(201)}`))).toContain('Câu dài');
    expect(describeProblems(checkScript('T', 'あ'.repeat(SCRIPT_LIMITS.body + 1)))).toContain(
      'Tách thành nhiều kịch bản',
    );
  });
});

describe('describeProblems', () => {
  it('names the rows and stops after five', () => {
    const body = Array.from({ length: 7 }, (_, i) => `line ${i + 1}`).join('\n');
    const text = describeProblems(checkScript('T', body));
    expect(text.split('\n')).toHaveLength(6);
    expect(text).toMatch(/^Dòng 1: /);
    expect(text).toContain('Và 2 lỗi khác.');
  });
});

describe('plainJapanese', () => {
  it('drops the readings, so speech and copy get plain Japanese', () => {
    expect(plainJapanese('料理[りょうり]を注文[ちゅうもん]します。')).toBe('料理を注文します。');
  });
});

describe('normalizeBody', () => {
  it('drops line-ending and trailing-space differences only', () => {
    expect(normalizeBody('\nA: はい。  \r\nB: いいえ。\n\n')).toBe('A: はい。\nB: いいえ。');
  });
});
