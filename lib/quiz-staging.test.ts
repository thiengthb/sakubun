import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/test-db';

createTestDb('sakubun-quizstage-');

type Practice = typeof import('@/lib/practice');
type Db = typeof import('@/lib/db');

let P: Practice;
let prisma: Db['prisma'];

const NOW = new Date('2026-07-28T09:00:00Z');
const TARGET = '〜わけにはいかない';
const DISTRACTORS = ['〜しかない', '〜ざるを得ない', '〜ほかない'];

async function seedItem(): Promise<{ itemId: string }> {
  await resetLearningData(prisma);
  const item = await prisma.item.create({
    data: {
      kind: 'GRAMMAR',
      expression: TARGET,
      meaningVi: 'không thể không',
      level: 'N2',
    },
  });
  return { itemId: item.id };
}

async function stageQuiz(itemId: string, sourceText = '仕事だから、行く(＿＿)。') {
  return P.stageSentence(
    {
      direction: 'JA_VI',
      exerciseType: 'QUIZ',
      sourceText,
      suggested: `Đáp án: ${TARGET} — vì là công việc nên không thể không đi.`,
      items: [{ itemId, role: 'TARGET' }],
      quiz: { correct: TARGET, distractors: DISTRACTORS },
    },
    NOW,
  );
}

beforeAll(async () => {
  P = await import('@/lib/practice');
  ({ prisma } = await import('@/lib/db'));
});

describe('the recorded question contains the options the server assigned', () => {
  it('appends the A-D line to the stored sourceText', async () => {
    const { itemId } = await seedItem();
    const { sentenceId, quiz } = await stageQuiz(itemId);
    expect(quiz).toBeDefined();
    const row = await prisma.sentence.findFirstOrThrow({ where: { id: sentenceId } });
    expect(row.sourceText).toContain('仕事だから、行く(＿＿)。');
    expect(row.sourceText).toContain(quiz!.line);
    for (const pattern of [TARGET, ...DISTRACTORS]) {
      expect(row.sourceText).toContain(pattern);
    }
  });

  it('makes the correct letter RECOVERABLE from the row alone', async () => {
    const { itemId } = await seedItem();
    const { sentenceId, quiz } = await stageQuiz(itemId);
    const row = await prisma.sentence.findFirstOrThrow({ where: { id: sentenceId } });
    const options = [...row.sourceText.matchAll(/\*\*([ABCD])\.\*\*\s*([^\n·|]+)/g)].map((m) => ({
      letter: m[1],
      pattern: m[2].trim(),
    }));
    expect(options).toHaveLength(4);
    expect(options.find((o) => o.pattern === TARGET)?.letter).toBe(quiz!.correctLetter);
  });

  it('keeps sourceRuby aligned, since ruby REPLACES the text wherever furigana is on', async () => {
    const { itemId } = await seedItem();
    const { sentenceId, quiz } = await P.stageSentence(
      {
        direction: 'JA_VI',
        exerciseType: 'QUIZ',
        sourceText: '仕事[しごと]だから(＿＿)。',
        sourceRuby: '仕事[しごと]だから(＿＿)。',
        suggested: 'x',
        items: [{ itemId, role: 'TARGET' }],
        quiz: { correct: TARGET, distractors: DISTRACTORS },
      },
      NOW,
    );
    const row = await prisma.sentence.findFirstOrThrow({ where: { id: sentenceId } });
    expect(row.sourceRuby).toContain(quiz!.line);
  });

  it('leaves a non-quiz sentence completely untouched', async () => {
    const { itemId } = await seedItem();
    const { sentenceId, quiz } = await P.stageSentence(
      {
        direction: 'JA_VI',
        exerciseType: 'TRANSLATION',
        sourceText: '毎日勉強しています。',
        suggested: 'Tôi học mỗi ngày.',
        items: [{ itemId, role: 'TARGET' }],
      },
      NOW,
    );
    expect(quiz).toBeUndefined();
    const row = await prisma.sentence.findFirstOrThrow({ where: { id: sentenceId } });
    expect(row.sourceText).toBe('毎日勉強しています。');
    expect(row.sourceText).not.toMatch(/\*\*[ABCD]\.\*\*/);
  });
});

describe('a malformed question never reaches the database', () => {
  it('throws on a duplicate option and stages NOTHING', async () => {
    const { itemId } = await seedItem();
    const before = await prisma.sentence.count({});
    await expect(
      P.stageSentence(
        {
          direction: 'JA_VI',
          exerciseType: 'QUIZ',
          sourceText: 'x(＿＿)',
          suggested: 'y',
          items: [{ itemId, role: 'TARGET' }],
          quiz: { correct: TARGET, distractors: ['わけにはいかない', 'a', 'b'] },
        },
        NOW,
      ),
    ).rejects.toThrow(/KHÁC nhau/);
    expect(await prisma.sentence.count({})).toBe(before);
  });
});
