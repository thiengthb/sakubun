// DB harness for what a QUIZ turn actually RECORDS.
//
// Why this test exists, precisely. On 2026-07-28 the server was given ownership of the quiz answer's
// position, and the protocol was told to send the options as data. A live measurement the same day
// found 35 of 35 quiz rows in the production database holding only the bare sentence: the four options
// existed nowhere but the chat. So the question the learner answered was unrecorded, the answer's
// position was unauditable, and the learner's report that it kept landing on C could be neither
// confirmed nor refuted. The mechanism was optional, and optional meant unused.
//
// These tests pin the two properties that make that impossible to repeat: the options reach the ROW,
// and the correct letter is RECOVERABLE from the row afterwards (which is what `npm run quiz:letters`
// relies on).

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-quizstage-')), 'test.db');
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
const TARGET = '〜わけにはいかない';
const DISTRACTORS = ['〜しかない', '〜ざるを得ない', '〜ほかない'];

/**
 * Seed THE target item for one case. Each test used to get its own user, so `[userId, kind, expression]`
 * let them all own the same pattern; the unique is `[kind, expression]` now, so isolation has to come
 * from clearing the tables first instead.
 */
async function seedItem(): Promise<{ itemId: string }> {
  await prisma.reviewLog.deleteMany({});
  await prisma.sentence.deleteMany({});
  await prisma.srsState.deleteMany({});
  await prisma.item.deleteMany({});
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
    // This is exactly what scripts/quiz-letter-audit.js does. If this assertion can pass, the
    // "is the answer always C" question is answerable by query instead of by memory.
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
    // Appending to only one of the two would hide the options from exactly the learners who have
    // furigana enabled — a silent, per-user regression.
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
    // The layout is built before the row is created on purpose: a rejected question must not leave a
    // pending row behind for autoSkipStalePending to sweep up as an abandoned exercise.
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
