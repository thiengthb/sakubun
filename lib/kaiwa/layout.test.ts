import { describe, expect, it } from 'vitest';
import { chooseMe, digestScript, layoutTurns, scriptSpeakers } from '@/lib/kaiwa/layout';
import { parseScript } from '@/lib/kaiwa/parse';

const lines = parseScript(
  [
    '店の中は静かだった。 | Trong quán yên tĩnh.',
    'A: いらっしゃいませ。 | Xin mời vào.',
    'A: 何名様ですか。 | Mấy người ạ?',
    'B: 二人です。 | Hai người.',
    'C: あ、三人です。 | À, ba người.',
    '店員は奥の席を指した。 | Nhân viên chỉ bàn trong.',
    'A: こちらへどうぞ。 | Mời đi lối này.',
  ].join('\n'),
);

const shape = (me: string | null) =>
  layoutTurns(lines, me).map((t) =>
    t.kind === 'speech'
      ? `${t.line.speaker} ${t.side} ${t.tone}${t.firstOfRun ? ' first' : ''}`
      : t.kind,
  );

describe('layoutTurns', () => {
  it("puts the learner's lines on the left, the others on the right, the scene in the middle", () => {
    expect(shape('A')).toEqual([
      'scene',
      'A mine 0 first',
      'A mine 0',
      'B theirs 1 first',
      'C theirs 2 first',
      'scene',
      // A scene ends a run: the next line names its speaker again.
      'A mine 0 first',
    ]);
  });

  it('turns around when the learner takes another part', () => {
    expect(shape('B')).toEqual([
      'scene',
      'A theirs 1 first',
      'A theirs 1',
      'B mine 0 first',
      'C theirs 2 first',
      'scene',
      'A theirs 1 first',
    ]);
  });

  it('reads a script with no speakers as narration', () => {
    const monologue = parseScript('今日は雨です。 | Hôm nay mưa.\n家にいます。 | Tôi ở nhà.');
    expect(layoutTurns(monologue, null).map((t) => t.kind)).toEqual(['narration', 'narration']);
  });
});

describe('chooseMe', () => {
  it('keeps the stored part while the script has it, else takes the first speaker', () => {
    const speakers = scriptSpeakers(lines);
    expect(speakers).toEqual(['A', 'B', 'C']);
    expect(chooseMe(speakers, 'B')).toBe('B');
    expect(chooseMe(speakers, 'D')).toBe('A');
    expect(chooseMe(speakers, null)).toBe('A');
    expect(chooseMe([], 'A')).toBeNull();
  });

  it('falls back to the part taken on the last script before the first speaker', () => {
    const speakers = scriptSpeakers(lines);
    expect(chooseMe(speakers, null, 'C')).toBe('C');
    expect(chooseMe(speakers, 'B', 'C')).toBe('B');
    expect(chooseMe(speakers, 'D', 'グエン')).toBe('A');
  });
});

describe('digestScript', () => {
  it('counts the lines, lists the speakers and quotes the first spoken line without readings', () => {
    expect(
      digestScript(
        '店の中は静かだった。 | Yên tĩnh.\nA: 何名様[なんめいさま]ですか。 | Mấy người?\nB: 二人です。',
      ),
    ).toEqual({ lineCount: 3, speakers: ['A', 'B'], firstLine: '何名様ですか。' });
  });

  it('quotes the first line of a monologue, and nothing of an empty script', () => {
    expect(digestScript('雨が降る。\n傘を持つ。')).toEqual({
      lineCount: 2,
      speakers: [],
      firstLine: '雨が降る。',
    });
    expect(digestScript('')).toEqual({ lineCount: 0, speakers: [], firstLine: '' });
  });
});
