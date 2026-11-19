'use server';

import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth/current-user';
import { ok, parseInput, type ActionResult } from '@/lib/core/action-result';
import { recognizeKanji } from '@/lib/japanese/recognize';
import { kanjiShapes } from '@/lib/kanji/load';

// Search by drawing (KD1, docs/plans/2026-11-19-kanji-draw-search.md): the pad sends its strokes, the
// server answers with the closest Jōyō kanji. Points are [x, y] pairs in the pad's own box.

/** More strokes than any Jōyō kanji (29) plus room for a few slips. */
const MAX_DRAWN_STROKES = 34;
/** Points the pad keeps per stroke; it thins longer strokes before sending. */
const MAX_STROKE_POINTS = 200;

const coordinate = z.number().finite().min(-10_000).max(10_000);
const drawingSchema = z
  .array(
    z
      .array(z.tuple([coordinate, coordinate]))
      .min(1)
      .max(MAX_STROKE_POINTS),
  )
  .min(1)
  .max(MAX_DRAWN_STROKES);

export async function recognizeKanjiAction(strokes: unknown): Promise<ActionResult<string[]>> {
  await getSessionUserId();
  const parsed = parseInput(drawingSchema, strokes, 'Nét vẽ không đọc được. Xoá hết rồi vẽ lại.');
  if (!parsed.ok) return parsed;
  const drawn = parsed.data.map((s) => s.map(([x, y]) => ({ x, y })));
  return ok(recognizeKanji(drawn, await kanjiShapes()));
}
