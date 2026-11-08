import type { UserDb } from '@/lib/db/user-db';
import { parseScript } from '@/lib/kaiwa/parse';
import {
  checkRoleplay,
  readRoleplayTurns,
  withModelLines,
  type RoleplayTurn,
  type SavedRoleplayTurn,
} from '@/lib/kaiwa/roleplay-log';
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
  const lines = parseScript(script.body);
  const checked = checkRoleplay(lines, input.part, input.turns);
  if (!checked.ok) return checked;
  const row = await db.roleplay.create({
    data: {
      userId: db.$ownerId(),
      scriptId: script.id,
      scriptTitle: script.title,
      part: checked.part,
      turns: JSON.stringify(withModelLines(lines, checked.turns)),
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

/** A saved role-play on Lịch sử (Kaiwa d2): each turn with the model line it had when saved. */
export interface RoleplayRow {
  id: string;
  scriptId: string;
  /** The script's current title while it exists (so Nhập vai lại names it right), else the saved one. */
  scriptTitle: string;
  /** False once the script is deleted: the row stays, with its saved title and model lines. */
  scriptExists: boolean;
  part: string;
  total: number;
  correct: number;
  createdAt: Date;
  turns: SavedRoleplayTurn[];
}

export async function listRoleplays(db: UserDb): Promise<RoleplayRow[]> {
  const rows = await db.roleplay.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const scripts = await db.script.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.scriptId))] } },
    select: { id: true, title: true },
  });
  const titles = new Map(scripts.map((s) => [s.id, s.title]));
  return rows.map((row) => {
    const title = titles.get(row.scriptId);
    return {
      id: row.id,
      scriptId: row.scriptId,
      scriptTitle: title ?? row.scriptTitle,
      scriptExists: title !== undefined,
      part: row.part,
      total: row.total,
      correct: row.correct,
      createdAt: row.createdAt,
      turns: readRoleplayTurns(row.turns),
    };
  });
}
