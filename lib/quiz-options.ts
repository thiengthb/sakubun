// Quiz option assembly — the SERVER decides where the correct answer sits, and proves the four
// options are a well-formed question before the learner ever sees them.
//
// Why this moved out of the prompt (2026-07-28). The protocol used to hand Claude a server-randomised
// `correctSlot` and ASK it to place the answer there. The learner reported the answer landing on C far
// too often, and nothing in the system could confirm or deny it: an instruction in a prompt is not an
// enforcement, and no code ever checked where the answer ended up. The fix is structural rather than
// stronger wording — Claude supplies the target pattern and three distractors as DATA, and the server
// shuffles them into A-D itself. Position bias is then impossible by construction, not discouraged.
//
// The validation half exists for the other reported defect: options that are all "correct". A question
// whose blank accepts two of its own options is unanswerable, and the learner correctly reads it as the
// app being broken. Only some of that is machine-checkable (a duplicate is; "means the same thing here"
// is not) — what IS checkable is enforced here, and the rest is stated as authoring rules in
// QUIZ_PROTOCOL. Enforce what you can, write down the rest, and never pretend the writing is enforcement.

import { normalizeExpression } from '@/lib/normalize';

export const QUIZ_LETTERS = ['A', 'B', 'C', 'D'] as const;
export type QuizLetter = (typeof QUIZ_LETTERS)[number];

export const QUIZ_OPTION_COUNT = QUIZ_LETTERS.length;
export const QUIZ_DISTRACTOR_COUNT = QUIZ_OPTION_COUNT - 1;

/** How many candidate distractors to hand the tutor. Enough to choose 3 from, short enough to read. */
export const MAX_DISTRACTOR_CANDIDATES = 8;

/**
 * Merge tiers of candidate distractors, best tier first, dropping the target and any duplicate.
 *
 * Why the server supplies candidates at all (2026-07-28). The protocol said "take distractors from
 * `enrichment.contrasts` first; if there aren't enough, pick patterns of similar meaning or form".
 * Measured on the live library: cards carry **1.6 contrasts on average** and a question needs **3**
 * distractors — so the fallback branch was firing on nearly every question, and "pick something
 * similar" from memory is where 会う next to 会います came from. The tutor was being asked to invent
 * library data it could not see. Handing it real patterns from the learner's own library replaces
 * invention with selection.
 */
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
  /** The four options in the order the learner sees them. */
  options: { letter: QuizLetter; pattern: string }[];
  /** Where the server put the target pattern. Nobody else chooses this. */
  correctLetter: QuizLetter;
  /** The option line, ready to display verbatim. */
  line: string;
};

/** Fisher-Yates, seeded by an injectable `rand` so a test can pin the order. */
function shuffled<T>(input: T[], rand: () => number): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Lay out one quiz question's options. Throws — in the learner's language, since the message travels
 * back to Claude as a tool error and Claude has to act on it — when the four options could not form an
 * answerable question. Rejecting at stage time is the point: a malformed question caught here costs one
 * retry, while the same question shown to the learner costs their trust and an FSRS row that means
 * nothing.
 */
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

  // Duplicate detection normalises first, so 「〜わけにはいかない」 and 「わけにはいかない」 count as the
  // same option — a "distractor" that is the answer wearing different decoration is the single easiest
  // way to ship a question with two correct answers.
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

/**
 * Read an option line back into its letter → pattern map — the inverse of `line` above.
 *
 * The layout is persisted ONLY as that rendered line, appended to `Sentence.sourceText` at stage time
 * (there is no quiz column). So this is the only way to audit a quiz turn after the fact, which is what
 * `quizAnswerMismatch` below needs.
 */
export function parseQuizOptionLine(text: string): { letter: QuizLetter; pattern: string }[] {
  const out: { letter: QuizLetter; pattern: string }[] = [];
  for (const letter of QUIZ_LETTERS) {
    // Each entry runs to the next "**X.**" marker or end of line, so a pattern containing · survives.
    const m = new RegExp(`\\*\\*${letter}\\.\\*\\*\\s*([^\\n]*?)(?=\\s*·\\s*\\*\\*[A-D]\\.\\*\\*|\\s*$)`, 'm').exec(text);
    if (m?.[1]?.trim()) out.push({ letter, pattern: m[1].trim() });
  }
  return out;
}

/**
 * A quiz answer that CONTRADICTS ITSELF: it names a letter, and it names a pattern, and the pattern at
 * that letter is a different one.
 *
 * Why this is worth a machine check. The server took placement away from Claude in 2026-07-28 because
 * position bias could not be confirmed or denied from the data. It fixed WHERE the answer sits, and left
 * the other half open: nothing verified that the grader READ the placement correctly. Caught in the lab
 * 2026-08-12 — the server put the target at D, the turn was recorded as "Chọn A: <the pattern at D>",
 * and both the rating and the learner-facing block were written from that. A mis-mapped letter means the
 * learner can be told they were wrong when they were right, and an FSRS row is written from it.
 *
 * DELIBERATELY CONSERVATIVE — it reports a mismatch only when it can point at the letter the answer
 * should have carried. A userAnswer with no letter, no pattern, or no recognisable option is not a
 * finding: `userAnswer` is free text written by a model, and a guard that fires on unfamiliar phrasing
 * would reject honest turns, which costs more than the bug it prevents.
 */
export function quizAnswerMismatch(
  sourceText: string,
  userAnswer: string,
): { named: QuizLetter; shouldBe: QuizLetter; patternAtNamed: string } | null {
  const options = parseQuizOptionLine(sourceText);
  if (options.length !== QUIZ_OPTION_COUNT) return null;

  // First standalone A-D in the answer, so "Chọn C: …" and "Đáp án B — …" and a bare "C" all read.
  const letterMatch = /(?:^|[^A-Za-z])([A-D])(?![A-Za-z])/.exec(userAnswer);
  if (!letterMatch) return null;
  const named = letterMatch[1] as QuizLetter;

  const rest = normalizeExpression(userAnswer.slice(letterMatch.index + letterMatch[0].length));
  if (!rest) return null;

  const at = options.find((o) => o.letter === named);
  if (!at) return null;
  if (rest.includes(normalizeExpression(at.pattern))) return null; // letter and pattern agree

  // Only a finding when some OTHER option is the one actually named — otherwise the answer simply does
  // not quote a pattern we can recognise, and silence is the honest response.
  const shouldBe = options.find(
    (o) => o.letter !== named && rest.includes(normalizeExpression(o.pattern)),
  );
  return shouldBe ? { named, shouldBe: shouldBe.letter, patternAtNamed: at.pattern } : null;
}
