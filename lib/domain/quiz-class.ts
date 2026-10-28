// What a cloze choice must share with the answer so that it can only be ruled out by knowing the
// item, not by grammar alone (docs/plans/2026-10-28-quick-review.md, C3): a word of the same part of
// speech, a pattern that attaches the same way. Classes come from OpenJLPT (`pos` tags from JMdict,
// the first label of a pattern's `formation`).

const VERB = /^(v1|v5|vk|vs-|vz)/;
const NOUN = new Set(['n', 'n-suf', 'num', 'pn', 'adj-no', 'ctr']);

/** The class of a word from its first JMdict tag, so a verb is only offered among verbs. */
export function vocabClass(pos: readonly string[] | null | undefined): string | null {
  const first = pos?.[0];
  if (!first) return null;
  if (VERB.test(first)) return 'verb';
  if (first === 'adj-i' || first === 'adj-ix') return 'adj-i';
  if (NOUN.has(first)) return 'noun';
  if (first === 'adv' || first === 'adv-to') return 'adv';
  return first;
}

/** The class of a pattern from what it attaches to ("Noun + より" → "Noun"). */
export function grammarClass(formation: string | null | undefined): string | null {
  const label = formation?.trim().match(/^[A-Za-z][A-Za-z-]*/)?.[0];
  if (!label) return null;
  // A plain-form verb and a dictionary-form verb take the same slot in a sentence.
  return label === 'Verb-plain' ? 'Verb-dict' : label;
}

/** A pattern as a learner sees it on a choice: English labels such as （subject） taken off. */
export function choiceLabel(expression: string): string {
  return expression.replace(/\s*[（(][^（）()]*[A-Za-z][^（）()]*[）)]/gu, '').trim();
}

/** A pattern in two parts (全然〜ない, 〜しか〜ない) does not fit one blank. */
export function isSplitPattern(expression: string): boolean {
  return /[^\s〜~～].*[〜~～].*[^\s〜~～]/u.test(expression.trim().replace(/^[〜~～]+/u, ''));
}
