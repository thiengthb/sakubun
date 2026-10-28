import { parseFurigana } from '@/lib/japanese/furigana';

// An example sentence split into pieces a card can draw: plain text, kanji with a reading, and the
// span (or spans) that is the item itself, either underlined (a flip card) or blanked (a cloze).

export interface Segment {
  text: string;
  reading?: string;
  mark?: 'target' | 'blank';
}

export interface Span {
  start: number;
  end: number;
}

function plain(ja: string, spans: readonly Span[], mark: 'target' | 'blank'): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const span of spans) {
    if (span.start > at) out.push({ text: ja.slice(at, span.start) });
    out.push({ text: mark === 'blank' ? '' : ja.slice(span.start, span.end), mark });
    at = span.end;
  }
  if (at < ja.length) out.push({ text: ja.slice(at) });
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
  return markSpans(ja, ruby, [span], mark);
}

// The same for an item in several pieces (しか…ない), the spans in order and apart.
export function markSpans(
  ja: string,
  ruby: string | null | undefined,
  spans: readonly Span[],
  mark: 'target' | 'blank',
): Segment[] {
  if (!ruby) return plain(ja, spans, mark);
  const parsed = parseFurigana(ruby);
  if (parsed.map((s) => s.text).join('') !== ja) return plain(ja, spans, mark);
  const within = (at: number) => spans.some((s) => at >= s.start && at < s.end);

  const out: Segment[] = [];
  let offset = 0;
  for (const segment of parsed) {
    const from = offset;
    const to = offset + segment.text.length;
    offset = to;
    const hits = spans.filter((s) => to > s.start && from < s.end);
    if (hits.length === 0) {
      out.push({ ...segment });
      continue;
    }
    if (segment.reading) {
      // A kanji run with one reading cannot be split: a target takes the whole run, a blank gives up.
      if (mark === 'blank' && hits.some((s) => from < s.start || to > s.end)) {
        return plain(ja, spans, mark);
      }
      out.push(mark === 'blank' ? { text: '', mark } : { ...segment, mark });
      continue;
    }
    // Kana: cut at every span edge inside the segment.
    const cuts = [from, ...hits.flatMap((s) => [s.start, s.end]), to]
      .filter((c) => c >= from && c <= to)
      .sort((a, b) => a - b)
      .filter((c, i, all) => i === 0 || c !== all[i - 1]);
    for (let i = 0; i < cuts.length - 1; i++) {
      const text = segment.text.slice(cuts[i] - from, cuts[i + 1] - from);
      if (!within(cuts[i])) out.push({ text });
      else out.push(mark === 'blank' ? { text: '', mark } : { text, mark });
    }
  }
  // One blank, however many pieces it covered.
  return out.filter((s, i) => !(s.mark === 'blank' && out[i - 1]?.mark === 'blank'));
}

export function segmentsText(segments: readonly Segment[], blank = '（　）'): string {
  return segments.map((s) => (s.mark === 'blank' ? blank : s.text)).join('');
}
