// The component network of one kanji (KJ6, docs/plans/2026-11-08-kanji.md › Bộ thủ và mạng lưới):
// the kanji in the middle, its visible parts around it (KanjiVG: 語 = 言 + 吾), and around each part
// the other Jōyō kanji built with it. The part that gives the sound (KanjiVG's phon) often keeps the
// Hán Việt (吾 NGÔ: 語 NGỮ, 悟 NGỘ), so it is marked. Pure: the catalog in, the network out.
import { compareKanji, type KanjiEntry } from '@/lib/kanji/catalog';
import type { RadicalRow } from '@/lib/kanji/data';

/** Kanji shown around one part before "Xem thêm". */
export const NETWORK_PER_PART = 12;

export interface NetworkPart {
  /** The part as KanjiVG writes it: a kanji (吾) or a radical form (氵). */
  part: string;
  /** Its own entry when the part is a Jōyō kanji. */
  entry: KanjiEntry | null;
  /** Its name: the Hán Việt of a kanji, or the Vietnamese name of a radical form (氵 thủy). */
  name: string | null;
  /** The part that gives the kanji its sound. */
  sound: boolean;
  /** Every other Jōyō kanji with this part, easiest first; the first NETWORK_PER_PART are drawn. */
  kanji: KanjiEntry[];
}

export interface KanjiNetwork {
  center: KanjiEntry;
  parts: NetworkPart[];
}

export type PartIndex = ReadonlyMap<string, readonly KanjiEntry[]>;

/** Which kanji each part appears in, built once for the catalog. */
export function partIndex(catalog: readonly KanjiEntry[]): Map<string, KanjiEntry[]> {
  const index = new Map<string, KanjiEntry[]>();
  for (const k of catalog)
    for (const p of new Set(k.parts)) {
      const list = index.get(p);
      if (list) list.push(k);
      else index.set(p, [k]);
    }
  for (const list of index.values()) list.sort(compareKanji);
  return index;
}

export function kanjiNetwork(
  center: KanjiEntry,
  catalog: readonly KanjiEntry[],
  index: PartIndex,
  radicals: readonly RadicalRow[],
): KanjiNetwork {
  const byKanji = new Map(catalog.map((k) => [k.kanji, k]));
  const radicalName = new Map<string, string>();
  for (const r of radicals)
    for (const form of [r.radical, ...r.variants]) radicalName.set(form, r.nameVi);
  const parts = [...new Set(center.parts)].map((part) => {
    const entry = byKanji.get(part) ?? null;
    return {
      part,
      entry,
      name: entry?.hanviet ?? radicalName.get(part) ?? null,
      sound: center.phon === part,
      kanji: (index.get(part) ?? []).filter((k) => k.kanji !== center.kanji),
    };
  });
  return { center, parts };
}
