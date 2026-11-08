import type { UserDb } from '@/lib/db/user-db';
import { CARD_STATE } from '@/lib/domain/queue';
import type { KanjiEntry } from '@/lib/kanji/catalog';
import { kanjiCatalog, kanjiPartIndex, kanjiRadicals, kanjiStrokes } from '@/lib/kanji/load';
import { kanjiNetwork } from '@/lib/kanji/network';
import { KANJI_KIND } from '@/lib/library/item-kinds';

// A kanji's own page (KJ6): its strokes and facts, and its component network coloured by what the
// learner has studied: none (faint), met in Ôn nhanh (new or learning), or remembered (review).

export type KanjiStudy = 'none' | 'new' | 'learning' | 'review';

export interface NetworkNode {
  kanji: string;
  hanviet: string;
  study: KanjiStudy;
}

export interface KanjiPagePart {
  part: string;
  name: string | null;
  sound: boolean;
  /** The part itself, when it is a Jōyō kanji with its own page. */
  node: NetworkNode | null;
  kanji: NetworkNode[];
}

export interface KanjiPage {
  kanji: KanjiEntry;
  paths: string[];
  study: KanjiStudy;
  parts: KanjiPagePart[];
}

/** What the learner has done with a kanji, from its card's FSRS state (none: no card). */
export const studyOf = (state: number | undefined): KanjiStudy =>
  state === undefined
    ? 'none'
    : state === CARD_STATE.REVIEW
      ? 'review'
      : state === CARD_STATE.NEW
        ? 'new'
        : 'learning';

export async function getKanjiPage(db: UserDb, char: string): Promise<KanjiPage | null> {
  const [catalog, index, radicals, strokes] = await Promise.all([
    kanjiCatalog(),
    kanjiPartIndex(),
    kanjiRadicals(),
    kanjiStrokes(),
  ]);
  const center = catalog.find((k) => k.kanji === char);
  if (!center) return null;
  const network = kanjiNetwork(center, catalog, index, radicals);
  const shown = new Set([
    center.kanji,
    ...network.parts.flatMap((p) => [p.part, ...p.kanji.map((k) => k.kanji)]),
  ]);
  const cards = await db.item.findMany({
    where: { kind: KANJI_KIND, expression: { in: [...shown] } },
    select: { expression: true, srs: { select: { state: true } } },
  });
  const state = new Map(cards.map((c) => [c.expression, c.srs?.state ?? CARD_STATE.NEW]));
  const node = (k: KanjiEntry): NetworkNode => ({
    kanji: k.kanji,
    hanviet: k.hanviet,
    study: studyOf(state.get(k.kanji)),
  });
  return {
    kanji: center,
    paths: strokes[center.kanji] ?? [],
    study: studyOf(state.get(center.kanji)),
    parts: network.parts.map((p) => ({
      part: p.part,
      name: p.name,
      sound: p.sound,
      node: p.entry ? node(p.entry) : null,
      kanji: p.kanji.map(node),
    })),
  };
}
