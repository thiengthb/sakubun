const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function cleanText(input: string): string {
  const decoded = input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const code = /^#x/i.test(body)
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
  return stripEmoji(decoded);
}

export function cleanTextOrNull(input: string | null | undefined): string | null {
  if (input == null) return null;
  return cleanText(input) || null;
}

const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}]/gu;

export function stripEmoji(input: string): string {
  return input.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

const TERM_WRAPPERS: [string, string][] = [
  ['「', '」'],
  ['『', '』'],
  ['【', '】'],
  ['〈', '〉'],
  ['《', '》'],
  ['"', '"'],
  ['“', '”'],
  ["'", "'"],
  ['‘', '’'],
];

const TRAILING_PARENTHETICAL = /[(（][^()（）]*[)）]\s*$/;

export function cleanVocabTerm(input: string): string {
  let term = input.trim();
  for (let before = ''; before !== term;) {
    before = term;
    for (const [open, close] of TERM_WRAPPERS) {
      if (
        term.length >= open.length + close.length &&
        term.startsWith(open) &&
        term.endsWith(close)
      ) {
        term = term.slice(open.length, -close.length).trim();
        break;
      }
    }
    term = term.replace(TRAILING_PARENTHETICAL, '').trim();
  }
  return term;
}

export function hasKanji(input: string): boolean {
  return /[㐀-鿿豈-﫿]/.test(input);
}
