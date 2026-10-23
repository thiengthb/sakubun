// A deterministic stand-in for a model tokenizer, so CI can track the size of what the MCP server
// sends without calling any API. It is a proxy for comparing versions of this server, not an exact
// count: ASCII runs about 4 characters per token, a CJK character is about one token, and other
// non-ASCII letters (Vietnamese with diacritics) about two characters per token.

function isCjk(code: number): boolean {
  return (
    (code >= 0x3000 && code <= 0x30ff) || // CJK punctuation, hiragana, katakana
    (code >= 0x3400 && code <= 0x9fff) || // CJK ideographs
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef) // full-width forms
  );
}

export function estimateTokens(text: string): number {
  let ascii = 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) ascii++;
    else if (isCjk(code)) cjk++;
    else other++;
  }
  return Math.ceil(ascii / 4 + cjk + other / 2);
}
