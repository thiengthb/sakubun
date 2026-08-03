// Expression normalization — collapsing the spellings of ONE pattern to a single key.
//
// It lives in its own module because three unrelated things need the exact same key and getting them
// out of sync would be silent: `lib/coach.ts` compares (is this pattern already mine?),
// `lib/lookup.ts` searches (a quoted query must still hit the row), and `lib/enrichment-merge.ts`
// dedups (is this contrast already on the card?). It also breaks a cycle: the merge needs the
// normalizer, and the coach needs the card scorer, so a normalizer living in either would import in a
// circle.

/**
 * Strip DECORATION only — quotes and the marks that mean "something attaches here".
 *
 * This is not cosmetic: `listPublicLibrary` computes `alreadyMine` by EXACT `(kind, expression)`, and
 * patterns genuinely arrive spelled several ways — `〜わけにはいかない` vs `わけにはいかない`, a
 * full-width vs ASCII tilde, wrapped in 「」. Without one key, "you already have this" and "here is a
 * duplicate to fork" become a coin flip.
 *
 * It deliberately stops short of despacing/lowercasing so the result is still usable as a SQL LIKE
 * search term — a Vietnamese meaning fragment ("không thể không") needs its inner spaces and case.
 */
export function stripDecoration(raw: string): string {
  return (
    raw
      // ORDER MATTERS, and getting it wrong is silent: quotes must go FIRST, because a quoted pattern
      // (「〜ばかりに」) has the bracket on the OUTSIDE, so stripping attachment marks first would leave
      // the tilde behind and 「〜ばかりに」 would not match 〜ばかりに. Found by its own unit test.
      .replace(/[「」『』"'“”‘’()（）]/gu, '')
      // Placeholder marks for "something attaches here": wave dash, fullwidth/ASCII tilde, ellipsis,
      // katakana middle dot — all mean the same thing and none is part of the pattern itself.
      .replace(/^[\s~〜～\-–—.．…・]+/u, '')
      .replace(/[\s~〜～\-–—.．…・]+$/u, '')
      .trim()
  );
}

/** The COMPARISON key: decoration-free, width-folded, space-free, lower-cased. Never for searching. */
export function normalizeExpression(raw: string): string {
  return stripDecoration(raw.normalize('NFKC')).replace(/\s+/gu, '').toLowerCase();
}

/** Do two expressions denote the same pattern? */
export function sameExpression(a: string, b: string): boolean {
  return normalizeExpression(a) === normalizeExpression(b);
}
