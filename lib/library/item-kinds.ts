export const GRAMMAR_KIND = 'GRAMMAR';
export const VOCAB_KIND = 'VOCAB';

export const ITEM_KINDS = [GRAMMAR_KIND, VOCAB_KIND] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export function asItemKind(kind: string | null | undefined): ItemKind {
  return kind === VOCAB_KIND ? VOCAB_KIND : GRAMMAR_KIND;
}

export function isVocab(kind: string | null | undefined): boolean {
  return kind === VOCAB_KIND;
}
