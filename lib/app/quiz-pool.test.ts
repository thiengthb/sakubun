import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildQuizPool, classOf } from '@/lib/app/quiz-pool';

const source = JSON.parse(
  readFileSync(path.join(process.cwd(), 'data/openjlpt/source.json'), 'utf8'),
);

describe('buildQuizPool', () => {
  const pool = buildQuizPool(source);

  it('holds every OpenJLPT item once, under ids that cannot be a learner item', () => {
    expect(pool.items.GRAMMAR.length).toBeGreaterThan(500);
    expect(pool.items.VOCAB.length).toBeGreaterThan(7000);
    const all = [...pool.items.GRAMMAR, ...pool.items.VOCAB];
    expect(all.every((i) => i.id.startsWith('openjlpt:'))).toBe(true);
    expect(new Set(all.map((i) => `${i.kind}:${i.expression}`)).size).toBe(all.length);
  });

  it('knows the class of almost every item', () => {
    const vocab = pool.items.VOCAB;
    expect(vocab.filter((i) => i.cls).length / vocab.length).toBeGreaterThan(0.99);
  });

  it('gives a learner item the class of its OpenJLPT twin, labels or not', () => {
    expect(classOf(pool, 'VOCAB', '多い')).toBe('adj-i');
    expect(classOf(pool, 'VOCAB', '開く')).toBe('verb');
    expect(classOf(pool, 'GRAMMAR', '〜より')).toBe('Noun');
    expect(classOf(pool, 'GRAMMAR', '〜が（subject）')).toBe('Noun');
    expect(classOf(pool, 'VOCAB', 'まだ見ぬ言葉')).toBeNull();
  });
});
