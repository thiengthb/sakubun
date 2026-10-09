export function stripDecoration(raw: string): string {
  return (
    raw
      .replace(/[「」『』"'“”‘’()（）]/gu, '')
      .replace(/^[\s~〜～\-–—.．…・]+/u, '')
      .replace(/[\s~〜～\-–—.．…・]+$/u, '')
      .trim()
  );
}

export function normalizeExpression(raw: string): string {
  return stripDecoration(raw.normalize('NFKC')).replace(/\s+/gu, '').toLowerCase();
}

export function sameExpression(a: string, b: string): boolean {
  return normalizeExpression(a) === normalizeExpression(b);
}
