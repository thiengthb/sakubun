import type { UserDb } from '@/lib/db/user-db';
import { parseScript } from '@/lib/kaiwa/parse';
import { checkRoleplay, type RoleplayTurn } from '@/lib/kaiwa/roleplay-log';
import { getScript } from '@/lib/kaiwa/scripts';

// Role-plays saved to Lịch sử (Kaiwa d). Checked by lib/kaiwa/roleplay-log.ts; never touches FSRS.

export type SaveRoleplayResult =
  | { ok: true; id: string; part: string; total: number; correct: number }
  | { ok: false; error: string };

export async function saveRoleplay(
  db: UserDb,
  input: { scriptId: string; part: string; turns: readonly RoleplayTurn[] },
): Promise<SaveRoleplayResult> {
  const script = await getScript(db, input.scriptId);
  if (!script) return { ok: false, error: 'Unknown scriptId. Call kaiwa_list for a current one.' };
  const checked = checkRoleplay(parseScript(script.body), input.part, input.turns);
  if (!checked.ok) return checked;
  const row = await db.roleplay.create({
    data: {
      userId: db.$ownerId(),
      scriptId: script.id,
      scriptTitle: script.title,
      part: checked.part,
      turns: JSON.stringify(checked.turns),
      total: checked.turns.length,
      correct: checked.correct,
    },
    select: { id: true },
  });
  return {
    ok: true,
    id: row.id,
    part: checked.part,
    total: checked.turns.length,
    correct: checked.correct,
  };
}
