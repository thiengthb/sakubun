import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { checkScript, describeProblems, normalizeBody } from '@/lib/kaiwa/parse';

// A learner's Kaiwa scripts (phase 8, K1). Every write goes through saveScript, so the web page and
// the AI over MCP (K2) get the same format check and the same guard against overwriting newer work.

export const MAX_SCRIPTS = 200;

export interface ScriptSummary {
  id: string;
  title: string;
  version: number;
  updatedAt: Date;
}

export interface ScriptRecord extends ScriptSummary {
  body: string;
  createdAt: Date;
}

export interface SaveScriptInput {
  // Absent: a new script. Present: the script to replace, with the version the writer last read.
  id?: string;
  version?: number;
  title: string;
  body: string;
}

const SUMMARY = { id: true, title: true, version: true, updatedAt: true } as const;

export async function listScripts(db: UserDb): Promise<ScriptSummary[]> {
  return db.script.findMany({ select: SUMMARY, orderBy: { updatedAt: 'desc' } });
}

export async function getScript(db: UserDb, id: string): Promise<ScriptRecord | null> {
  return db.script.findFirst({ where: { id } });
}

export async function saveScript(
  db: UserDb,
  input: SaveScriptInput,
): Promise<ActionResult<ScriptSummary>> {
  const title = input.title.trim();
  const body = normalizeBody(input.body);
  const problems = checkScript(title, body);
  if (problems.length > 0) return err(describeProblems(problems));

  if (input.id === undefined) {
    if ((await db.script.count()) >= MAX_SCRIPTS) {
      return err(`Đã có ${MAX_SCRIPTS} kịch bản. Xoá bớt kịch bản cũ rồi lưu lại.`);
    }
    const created = await db.script.create({
      data: { userId: db.$ownerId(), title, body },
      select: SUMMARY,
    });
    return ok(created);
  }

  if (input.version === undefined) {
    return err('Thiếu số phiên bản. Đọc kịch bản trước rồi lưu kèm số phiên bản đã đọc.');
  }
  // Compare and bump in one statement: two writers holding the same version cannot both win.
  const { count } = await db.script.updateMany({
    where: { id: input.id, version: input.version },
    data: { title, body, version: { increment: 1 } },
  });
  const current = await db.script.findFirst({ where: { id: input.id }, select: SUMMARY });
  if (!current) return err('Không tìm thấy kịch bản này. Có thể nó đã bị xoá.');
  if (count === 0) {
    return err(
      `Kịch bản đã được sửa sau lần bạn đọc (bản ${input.version}, nay là bản ${current.version}). ` +
        'Đọc lại bản mới rồi sửa trên đó.',
    );
  }
  return ok(current);
}

export async function deleteScript(db: UserDb, id: string): Promise<boolean> {
  const { count } = await db.script.deleteMany({ where: { id } });
  return count > 0;
}
