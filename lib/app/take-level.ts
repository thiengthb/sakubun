import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { loadLevelSets } from '@/lib/app/level-sets';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import type { LevelKind } from '@/lib/library/level-screen';
import type { BoardLevel } from '@/lib/library/level-tally';
import { takeEntries } from '@/lib/library/take';

// "Lấy nốt" and a set's "Lấy N" on the level and set screens (U4d, docs/plans/2026-11-14-u4-kho.md):
// the words of the level (or of one set) the learner lacks, worked out again on the server, so the
// button takes what the screen counts and nothing the learner did not see.
export async function takeLevelWords(
  db: UserDb,
  level: BoardLevel,
  kind: LevelKind,
  set: number | null,
): Promise<ActionResult<{ added: number }>> {
  const { sets } = await loadLevelSets(db, level, kind === 'grammar' ? GRAMMAR_KIND : VOCAB_KIND);
  const words = set === null ? sets.flatMap((s) => s.words) : sets[set - 1]?.words;
  if (!words) return err('Không có chặng này, tải lại trang để xem các chặng mới.');
  const missing = words.filter((w) => w.state === 'none').map((w) => w.entry.id);
  return ok({ added: await takeEntries(db, missing) });
}
