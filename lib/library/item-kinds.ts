export const GRAMMAR_KIND = 'GRAMMAR';
export const VOCAB_KIND = 'VOCAB';

// A kanji is a third kind of item (KJ2, docs/plans/2026-11-08-kanji.md): one card per character,
// reviewed in Ôn nhanh only. It is not an ItemKind: the translation loop, the grammar/vocab
// queues and the pools keyed by ItemKind never see it.
export const KANJI_KIND = 'KANJI';

export const ITEM_KINDS = [GRAMMAR_KIND, VOCAB_KIND] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export function asItemKind(kind: string | null | undefined): ItemKind {
  return kind === VOCAB_KIND ? VOCAB_KIND : GRAMMAR_KIND;
}

export function isVocab(kind: string | null | undefined): boolean {
  return kind === VOCAB_KIND;
}

export function isKanji(kind: string | null | undefined): boolean {
  return kind === KANJI_KIND;
}
