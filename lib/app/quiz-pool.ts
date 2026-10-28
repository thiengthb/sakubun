import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeExpression } from '@/lib/core/normalize';
import type { ClozeItem } from '@/lib/domain/cloze';
import { choiceLabel, grammarClass, vocabClass } from '@/lib/domain/quiz-class';
import type { OjSource } from '@/lib/import/openjlpt';
import { GRAMMAR_KIND, VOCAB_KIND, type ItemKind } from '@/lib/library/item-kinds';

// Where cloze distractors come from: the whole OpenJLPT list, not the learner's own items, so a new
// account that took ten items still gets a cloze and the same few hundred words do not come back as
// distractors every day (docs/plans/2026-10-28-quick-review.md, C3). The list also tells the class
// (part of speech, attachment) of a learner's item that shares its expression.

export interface QuizPool {
  items: Record<ItemKind, ClozeItem[]>;
  // By kind and normalized expression; a learner's own item takes the class of its OpenJLPT twin.
  classes: Map<string, string | null>;
}

const classKey = (kind: string, expression: string) =>
  `${kind}\u0000${normalizeExpression(choiceLabel(expression))}`;

export function buildQuizPool(source: OjSource): QuizPool {
  const pool: QuizPool = { items: { [GRAMMAR_KIND]: [], [VOCAB_KIND]: [] }, classes: new Map() };
  const rows: { e: OjSource['vocab'][number]; kind: ItemKind; cls: string | null }[] = [
    ...source.grammar.map(
      (e) => ({ e, kind: GRAMMAR_KIND, cls: grammarClass(e.formation) }) as const,
    ),
    ...source.vocab.map((e) => ({ e, kind: VOCAB_KIND, cls: vocabClass(e.pos) }) as const),
  ];
  for (const { e, kind, cls } of rows) {
    // The same word listed at two levels keeps its first (easier) entry.
    const key = classKey(kind, e.expression);
    if (pool.classes.has(key)) continue;
    pool.classes.set(key, cls);
    pool.items[kind].push({
      id: `openjlpt:${e.id}`,
      kind,
      expression: e.expression,
      reading: e.reading ?? null,
      level: e.level,
      cls,
    });
  }
  return pool;
}

export function classOf(pool: QuizPool, kind: string, expression: string): string | null {
  return pool.classes.get(classKey(kind, expression)) ?? null;
}

let cached: Promise<QuizPool> | null = null;

// Built once per process from data/openjlpt/source.json.
export function quizPool(): Promise<QuizPool> {
  cached ??= readFile(path.join(process.cwd(), 'data/openjlpt/source.json'), 'utf8').then((text) =>
    buildQuizPool(JSON.parse(text)),
  );
  return cached;
}
