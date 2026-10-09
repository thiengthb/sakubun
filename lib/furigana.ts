const KANJI = /[㐀-䶿一-鿿々〆〇ヶ]+$/;

export interface FuriganaSegment {
  text: string;
  reading?: string;
}

export function parseFurigana(markup: string): FuriganaSegment[] {
  const segments: FuriganaSegment[] = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (text: string, reading?: string) => {
    if (!text) return;
    segments.push(reading ? { text, reading } : { text });
  };
  while ((m = re.exec(markup)) !== null) {
    const reading = m[1].trim();
    const before = markup.slice(last, m.index);
    const baseMatch = before.match(KANJI);
    const base = baseMatch ? baseMatch[0] : '';
    const literal = base ? before.slice(0, before.length - base.length) : before;
    push(literal);
    if (base && reading)
      push(base, reading); // real furigana: kanji base + a reading
    else if (base)
      push(base); // empty `[]` right after kanji → keep the kanji, drop the brackets
    else if (reading) push(`[${reading}]`); // no kanji base but has content → show as-is (not furigana)
    last = re.lastIndex;
  }
  push(markup.slice(last));
  return segments;
}

export function hasFurigana(markup: string | null | undefined): boolean {
  return !!markup && parseFurigana(markup).some((s) => s.reading);
}

const KANJI_CHAR = /[㐀-䶿一-鿿々〆〇ヶ]/;
const KANA_CHAR = /[ぁ-んァ-ヶーゝゞ]/;

function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function buildFuriganaMarkup(
  expression: string,
  reading: string | null | undefined,
): string | null {
  if (!reading) return null;
  reading = reading.replace(/[〜～]/g, '');
  if (!reading) return null;
  type Kind = 'kanji' | 'kana' | 'other';
  const kindOf = (c: string): Kind =>
    KANJI_CHAR.test(c) ? 'kanji' : KANA_CHAR.test(c) ? 'kana' : 'other';

  const runs: { text: string; kind: Kind }[] = [];
  for (const ch of expression) {
    const kind = kindOf(ch);
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else runs.push({ text: ch, kind });
  }
  if (!runs.some((r) => r.kind === 'kanji')) return null; // nothing to annotate

  const rd = toHiragana(reading);
  let r = 0;
  let out = '';
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (run.kind === 'other') {
      out += run.text; // 〜, punctuation — literal, consumes no reading
      continue;
    }
    if (run.kind === 'kana') {
      const kana = toHiragana(run.text);
      if (toHiragana(rd.slice(r, r + kana.length)) !== kana)
        return fallback(runs, expression, reading);
      out += run.text;
      r += kana.length;
      continue;
    }
    let nextKana = '';
    for (let j = i + 1; j < runs.length; j++) {
      if (runs[j].kind === 'kana') {
        nextKana = toHiragana(runs[j].text);
        break;
      }
      if (runs[j].kind === 'kanji') break; // adjacent kanji run (via `other`) — no kana boundary
    }
    const end = nextKana ? rd.indexOf(nextKana, r + 1) : rd.length;
    if (end === -1 || end <= r) return fallback(runs, expression, reading);
    out += `${run.text}[${reading.slice(r, end)}]`;
    r += end - r;
  }
  return r === rd.length ? out : fallback(runs, expression, reading);
}

function fallback(
  runs: { text: string; kind: string }[],
  expression: string,
  reading: string,
): string | null {
  return runs.length === 1 && runs[0].kind === 'kanji' ? `${expression}[${reading}]` : null;
}
