import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { takeKanjiLevel } from '@/lib/app/kanji-levels';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { saveSettings } from '@/lib/library/practice';
import { findOpenJlptGroup } from '@/lib/library/shared';
import { takeGroup } from '@/lib/library/take';
import type { JlptLevel } from '@/lib/settings/schema';

// A newcomer's level pick on Hôm nay (plan 2026-11-14-u3-today, U3c; UI v2 B3, B11): one tap takes
// the level's grammar, words and kanji from Kho chung and studies from that level (new patterns and
// words come from it and the levels below). Every step can
// run again and only fills what is missing, so a pick cut short is finished by picking again.

export interface StartLevelResult {
  grammar: number;
  vocab: number;
  kanji: number;
}

export async function startAtLevel(
  db: UserDb,
  level: JlptLevel,
  now: Date = new Date(),
): Promise<ActionResult<StartLevelResult>> {
  const [grammarGroup, vocabGroup] = await Promise.all([
    findOpenJlptGroup(db, level, GRAMMAR_KIND),
    findOpenJlptGroup(db, level, VOCAB_KIND),
  ]);
  if (!grammarGroup && !vocabGroup) return err(`Kho chung chưa có bộ ${level}.`);
  // The level first: a pick cut short after the grammar is taken leaves the Today page with items,
  // so the level pick is gone; with the level saved, the items taken still come up for study.
  await saveSettings(db, { grammarLevel: level, vocabLevel: level });

  let grammar = 0;
  let vocab = 0;
  for (const [group, kind] of [
    [grammarGroup, GRAMMAR_KIND],
    [vocabGroup, VOCAB_KIND],
  ] as const) {
    if (!group) continue;
    const taken = await takeGroup(db, group.id);
    if (!taken.ok) return taken;
    if (kind === GRAMMAR_KIND) grammar = taken.data.added;
    else vocab = taken.data.added;
  }
  const kanji = (await takeKanjiLevel(db, level, now)).added;
  return ok({ grammar, vocab, kanji });
}
