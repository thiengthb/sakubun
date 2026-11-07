import type { UserDb } from '@/lib/db/user-db';
import { parseScript, plainJapanese } from '@/lib/kaiwa/parse';
import { checkRoleplay, readRoleplayTurns, type RoleplayTurn } from '@/lib/kaiwa/roleplay-log';
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

/** A saved role-play on Lịch sử (Kaiwa d2): each turn with its model line, while the script lasts. */
export interface RoleplayRow {
  id: string;
  scriptId: string;
  scriptTitle: string;
  /** False once the script is deleted: the row stays, without its model lines. */
  scriptExists: boolean;
  part: string;
  total: number;
  correct: number;
  createdAt: Date;
  turns: (RoleplayTurn & { model: { japanese: string; translation: string | null } | null })[];
}

export async function listRoleplays(db: UserDb): Promise<RoleplayRow[]> {
  const rows = await db.roleplay.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const scripts = await db.script.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.scriptId))] } },
    select: { id: true, body: true },
  });
  const lines = new Map(scripts.map((s) => [s.id, parseScript(s.body)]));
  return rows.map((row) => {
    const script = lines.get(row.scriptId);
    return {
      id: row.id,
      scriptId: row.scriptId,
      scriptTitle: row.scriptTitle,
      scriptExists: !!script,
      part: row.part,
      total: row.total,
      correct: row.correct,
      createdAt: row.createdAt,
      turns: readRoleplayTurns(row.turns).map((turn) => {
        const line = script?.[turn.turn - 1];
        return {
          ...turn,
          model: line
            ? { japanese: plainJapanese(line.japanese), translation: line.translation }
            : null,
        };
      }),
    };
  });
}
