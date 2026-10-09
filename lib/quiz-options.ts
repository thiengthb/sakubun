import { normalizeExpression } from '@/lib/normalize';

export const QUIZ_LETTERS = ['A', 'B', 'C', 'D'] as const;
export type QuizLetter = (typeof QUIZ_LETTERS)[number];

export const QUIZ_OPTION_COUNT = QUIZ_LETTERS.length;
export const QUIZ_DISTRACTOR_COUNT = QUIZ_OPTION_COUNT - 1;

export const MAX_DISTRACTOR_CANDIDATES = 8;

export function mergeDistractorCandidates(target: string, tiers: readonly string[][]): string[] {
  const seen = new Set<string>([normalizeExpression(target)]);
  const out: string[] = [];
  for (const tier of tiers) {
    for (const raw of tier) {
      const value = (raw || '').trim();
      if (!value) continue;
      const key = normalizeExpression(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(value);
      if (out.length >= MAX_DISTRACTOR_CANDIDATES) return out;
    }
  }
  return out;
}

export type QuizOptions = {
  options: { letter: QuizLetter; pattern: string }[];
  correctLetter: QuizLetter;
  line: string;
};

function shuffled<T>(input: T[], rand: () => number): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildQuizOptions(
  correct: string,
  distractors: string[],
  rand: () => number = Math.random,
): QuizOptions {
  const clean = (s: string) => (typeof s === 'string' ? s.trim() : '');
  const target = clean(correct);
  const others = distractors.map(clean);

  if (!target) throw new Error('quiz.correct trống — phải là mẫu ngữ pháp đang được hỏi.');
  if (others.length !== QUIZ_DISTRACTOR_COUNT || others.some((d) => !d)) {
    throw new Error(
      `quiz.distractors phải có đúng ${QUIZ_DISTRACTOR_COUNT} mẫu khác nhau, không rỗng (nhận được ${others.length}).`,
    );
  }

  const keys = [target, ...others].map(normalizeExpression);
  const seen = new Set<string>();
  for (let i = 0; i < keys.length; i++) {
    if (seen.has(keys[i])) {
      throw new Error(
        `Bốn phương án phải KHÁC nhau: "${[target, ...others][i]}" bị trùng với một phương án khác ` +
          `(so sánh sau khi bỏ 〜, dấu ngoặc và khoảng trắng). Câu hỏi có hai đáp án đúng là câu hỏi hỏng.`,
      );
    }
    seen.add(keys[i]);
  }

  const order = shuffled(
    [
      { pattern: target, isCorrect: true },
      ...others.map((pattern) => ({ pattern, isCorrect: false })),
    ],
    rand,
  );
  const options = order.map((o, i) => ({ letter: QUIZ_LETTERS[i], pattern: o.pattern }));
  const correctLetter = QUIZ_LETTERS[order.findIndex((o) => o.isCorrect)];

  return {
    options,
    correctLetter,
    line: options.map((o) => `**${o.letter}.** ${o.pattern}`).join(' · '),
  };
}

export function parseQuizOptionLine(text: string): { letter: QuizLetter; pattern: string }[] {
  const out: { letter: QuizLetter; pattern: string }[] = [];
  for (const letter of QUIZ_LETTERS) {
    const m = new RegExp(`\\*\\*${letter}\\.\\*\\*\\s*([^\\n]*?)(?=\\s*·\\s*\\*\\*[A-D]\\.\\*\\*|\\s*$)`, 'm').exec(text);
    if (m?.[1]?.trim()) out.push({ letter, pattern: m[1].trim() });
  }
  return out;
}

export function quizAnswerMismatch(
  sourceText: string,
  userAnswer: string,
): { named: QuizLetter; shouldBe: QuizLetter; patternAtNamed: string } | null {
  const options = parseQuizOptionLine(sourceText);
  if (options.length !== QUIZ_OPTION_COUNT) return null;

  const letterMatch = /(?:^|[^A-Za-z])([A-D])(?![A-Za-z])/.exec(userAnswer);
  if (!letterMatch) return null;
  const named = letterMatch[1] as QuizLetter;

  const rest = normalizeExpression(userAnswer.slice(letterMatch.index + letterMatch[0].length));
  if (!rest) return null;

  const at = options.find((o) => o.letter === named);
  if (!at) return null;
  if (rest.includes(normalizeExpression(at.pattern))) return null; // letter and pattern agree

  const shouldBe = options.find(
    (o) => o.letter !== named && rest.includes(normalizeExpression(o.pattern)),
  );
  return shouldBe ? { named, shouldBe: shouldBe.letter, patternAtNamed: at.pattern } : null;
}
