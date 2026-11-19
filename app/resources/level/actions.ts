'use server';

import { revalidatePath } from 'next/cache';
import { getUserDb } from '@/lib/auth/current-user';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { takeLevelWords } from '@/lib/app/take-level';
import { JLPT_LEVELS } from '@/lib/kanji/data';
import { GRAMMAR_KIND } from '@/lib/library/item-kinds';
import { takenNote, type LevelKind } from '@/lib/library/level-screen';
import type { BoardLevel } from '@/lib/library/level-tally';
import { getSettings } from '@/lib/library/practice';
import { takeEntry } from '@/lib/library/take';

// Taking words in place on Kho's level screens (U4d). The toast says whether Ôn nhanh brings them,
// which depends on the level studied (Cài đặt › Luyện tập).

const refresh = () => {
  revalidatePath('/resources', 'layout');
  revalidatePath('/library', 'layout');
};

const studyLevel = async (db: Awaited<ReturnType<typeof getUserDb>>, kind: LevelKind) => {
  const s = await getSettings(db);
  return kind === 'grammar' ? s.grammarLevel : s.vocabLevel;
};

export async function takeLevelAction(
  level: string,
  kind: string,
  set: number | null,
  confirmed: boolean,
): Promise<ActionResult<{ message: string }>> {
  if (!(JLPT_LEVELS as readonly string[]).includes(level)) return err('Không có cấp này.');
  if (kind !== 'grammar' && kind !== 'vocab') return err('Không có loại mục này.');
  if (set !== null && !(Number.isInteger(set) && set >= 1)) return err('Không có chặng này.');
  const db = await getUserDb();
  const taken = await takeLevelWords(db, level as BoardLevel, kind, set, confirmed === true);
  if (!taken.ok) return taken;
  refresh();
  return ok({
    message: takenNote({ added: taken.data.added, level, kind }, await studyLevel(db, kind)),
  });
}

/** "Học" on a word not in the learner's Kho yet. */
export async function takeWordAction(entryId: string): Promise<ActionResult<{ message: string }>> {
  const db = await getUserDb();
  const taken = await takeEntry(db, entryId);
  if (!taken.ok) return taken;
  refresh();
  if (taken.data.already) return ok({ message: 'Mục này đã có trong kho' });
  const item = await db.item.findFirst({
    where: { id: taken.data.itemId },
    select: { kind: true, level: true },
  });
  const kind: LevelKind = item?.kind === GRAMMAR_KIND ? 'grammar' : 'vocab';
  return ok({
    message: takenNote({ added: 1, level: item?.level ?? null, kind }, await studyLevel(db, kind)),
  });
}
