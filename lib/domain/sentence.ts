import { parseFurigana } from '@/lib/japanese/furigana';

// An example sentence split into pieces a card can draw: plain text, kanji with a reading, and the
// one span that is the item itself, either underlined (a flip card) or blanked (a cloze).

export interface Segment {
  text: string;
  reading?: string;
  mark?: 'target' | 'blank';
}

export interface Span {
  start: number;
  end: number;
}

function plain(ja: string, span: Span, mark: 'target' | 'blank'): Segment[] {
  const out: Segment[] = [];
  if (span.start > 0) out.push({ text: ja.slice(0, span.start) });
  out.push({ text: mark === 'blank' ? '' : ja.slice(span.start, span.end), mark });
  if (span.end < ja.length) out.push({ text: ja.slice(span.end) });
  return out;
}

// `ruby` is 漢字[かな] markup of the same sentence. When it does not spell `ja`, or a reading crosses
// the edge of a blank (so half of it would give the answer away), the furigana is left out.
export function markSpan(
  ja: string,
  ruby: string | null | undefined,
  span: Span,
  mark: 'target' | 'blank',
): Segment[] {
  if (!ruby) return plain(ja, span, mark);
  const parsed = parseFurigana(ruby);
  if (parsed.map((s) => s.text).join('') !== ja) return plain(ja, span, mark);

  const out: Segment[] = [];
  let offset = 0;
  for (const segment of parsed) {
    const from = offset;
    const to = offset + segment.text.length;
    offset = to;
    const inside = to > span.start && from < span.end;
    if (!inside) {
      out.push({ ...segment });
      continue;
    }
    if (segment.reading) {
      // A kanji run with one reading cannot be split: a target takes the whole run, a blank gives up.
      if (mark === 'blank' && (from < span.start || to > span.end)) return plain(ja, span, mark);
      out.push(mark === 'blank' ? { text: '', mark } : { ...segment, mark });
      continue;
    }
    if (from < span.start) out.push({ text: segment.text.slice(0, span.start - from) });
    const piece = segment.text.slice(Math.max(0, span.start - from), span.end - from);
    out.push(mark === 'blank' ? { text: '', mark } : { text: piece, mark });
    if (to > span.end) out.push({ text: segment.text.slice(span.end - from) });
  }
  // One blank, however many pieces it covered.
  return out.filter((s, i) => !(s.mark === 'blank' && out[i - 1]?.mark === 'blank'));
}

export function segmentsText(segments: readonly Segment[], blank = '（　）'): string {
  return segments.map((s) => (s.mark === 'blank' ? blank : s.text)).join('');
}
