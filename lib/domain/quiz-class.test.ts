import { describe, expect, it } from 'vitest';
import { choiceLabel, grammarClass, isSplitPattern, vocabClass } from '@/lib/domain/quiz-class';

describe('vocabClass', () => {
  it('groups JMdict tags by the slot a word takes in a sentence', () => {
    expect(vocabClass(['v5u', 'vi'])).toBe('verb');
    expect(vocabClass(['v1', 'vt'])).toBe('verb');
    expect(vocabClass(['vs-s'])).toBe('verb');
    expect(vocabClass(['adj-i'])).toBe('adj-i');
    expect(vocabClass(['adj-na', 'n'])).toBe('adj-na');
    expect(vocabClass(['n', 'vs', 'vt'])).toBe('noun');
    expect(vocabClass(['adj-no', 'n'])).toBe('noun');
    expect(vocabClass(['adv-to'])).toBe('adv');
    expect(vocabClass(['int'])).toBe('int');
    expect(vocabClass([])).toBeNull();
    expect(vocabClass(undefined)).toBeNull();
  });
});

describe('grammarClass', () => {
  it('takes what the pattern attaches to', () => {
    expect(grammarClass('Noun + より')).toBe('Noun');
    expect(grammarClass('Verb-te + もいい')).toBe('Verb-te');
    expect(grammarClass('Verb-plain + わけだ')).toBe('Verb-dict');
    expect(grammarClass('まだ + Verb-te いない')).toBeNull();
    expect(grammarClass(null)).toBeNull();
  });
});

describe('choiceLabel', () => {
  it('drops English labels and keeps Japanese optional parts', () => {
    expect(choiceLabel('〜が（subject）')).toBe('〜が');
    expect(choiceLabel('〜な（na-adjective）')).toBe('〜な');
    expect(choiceLabel('〜に（place of existence）')).toBe('〜に');
    expect(choiceLabel('〜場合（は）')).toBe('〜場合（は）');
    expect(choiceLabel('〜(よ)うと思う')).toBe('〜(よ)うと思う');
    expect(choiceLabel('約束')).toBe('約束');
  });
});

describe('isSplitPattern', () => {
  it('finds patterns in two parts', () => {
    expect(isSplitPattern('全然〜ない')).toBe(true);
    expect(isSplitPattern('〜しか〜ない')).toBe(true);
    expect(isSplitPattern('〜てもいい')).toBe(false);
    expect(isSplitPattern('〜より')).toBe(false);
    expect(isSplitPattern('約束')).toBe(false);
  });
});
