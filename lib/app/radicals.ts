import type { UserDb } from '@/lib/db/user-db';
import { ownedKanji } from '@/lib/app/kanji-items';
import { CARD_STATE } from '@/lib/domain/queue';
import { compareKanji } from '@/lib/kanji/catalog';
import type { RadicalRow } from '@/lib/kanji/data';
import { kanjiCatalog, kanjiRadicals } from '@/lib/kanji/load';
import { KANJI_KIND } from '@/lib/library/item-kinds';
import { studyOf, type NetworkNode } from '@/lib/app/kanji-page';

// The radicals page (KJ7, docs/plans/2026-11-08-kanji.md › Bộ thủ và mạng lưới): the 214 Kangxi
// radicals by stroke count, each with its Vietnamese name and how many of its Jōyō kanji the learner
// has met; a radical opens the kanji filed under it. Radicals have no cards of their own (thien,
// answer 7): they are learnt through the kanji.

export interface RadicalSummary {
  number: number;
  radical: string;
  variants: string[];
  nameVi: string;
  meaningVi: string;
  strokes: number;
  /** Jōyō kanji filed under it (KANJIDIC2), and how many of them the learner has a card for. */
  joyo: number;
  met: number;
}

const summary = (r: RadicalRow, joyo: number, met: number): RadicalSummary => ({
  number: r.number,
  radical: r.radical,
  variants: r.variants,
  nameVi: r.nameVi,
  meaningVi: r.meaningVi,
  strokes: r.strokes,
  joyo,
  met,
});

export async function listRadicals(db: UserDb): Promise<RadicalSummary[]> {
  const [radicals, catalog, have] = await Promise.all([
    kanjiRadicals(),
    kanjiCatalog(),
    ownedKanji(db),
  ]);
  const joyo = new Map<number, number>();
  const met = new Map<number, number>();
  for (const k of catalog) {
    const n = k.radical.number;
    joyo.set(n, (joyo.get(n) ?? 0) + 1);
    if (have.has(k.kanji)) met.set(n, (met.get(n) ?? 0) + 1);
  }
  return radicals
    .map((r) => summary(r, joyo.get(r.number) ?? 0, met.get(r.number) ?? 0))
    .sort((a, b) => a.strokes - b.strokes || a.number - b.number);
}

export interface RadicalPage {
  radical: RadicalSummary;
  kanji: NetworkNode[];
}

export async function getRadicalPage(db: UserDb, number: number): Promise<RadicalPage | null> {
  const [radicals, catalog] = await Promise.all([kanjiRadicals(), kanjiCatalog()]);
  const row = radicals.find((r) => r.number === number);
  if (!row) return null;
  const kanji = catalog.filter((k) => k.radical.number === number).sort(compareKanji);
  const cards = await db.item.findMany({
    where: { kind: KANJI_KIND, expression: { in: kanji.map((k) => k.kanji) } },
    select: { expression: true, srs: { select: { state: true } } },
  });
  const state = new Map(cards.map((c) => [c.expression, c.srs?.state ?? CARD_STATE.NEW]));
  return {
    radical: summary(row, kanji.length, cards.length),
    kanji: kanji.map((k) => ({
      kanji: k.kanji,
      hanviet: k.hanviet,
      study: studyOf(state.get(k.kanji)),
    })),
  };
}
