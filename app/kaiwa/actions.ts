'use server';

import { revalidatePath } from 'next/cache';
import { getUserDb } from '@/lib/auth/current-user';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import {
  deleteScript,
  saveScript,
  type SaveScriptInput,
  type ScriptSummary,
} from '@/lib/kaiwa/scripts';

export async function deleteScriptAction(scriptId: string): Promise<ActionResult> {
  const db = await getUserDb();
  if (!(await deleteScript(db, scriptId))) {
    return err('Không tìm thấy kịch bản này. Có thể nó đã bị xoá.');
  }
  revalidatePath('/kaiwa');
  return ok(undefined);
}

// The web editor's save (K3c): the same saveScript the AI's kaiwa_save calls, so the format check
// and the guard against overwriting a newer version hold on both paths.
export async function saveScriptAction(
  input: SaveScriptInput,
): Promise<ActionResult<ScriptSummary>> {
  const db = await getUserDb();
  const saved = await saveScript(db, input);
  if (saved.ok) {
    revalidatePath('/kaiwa');
    revalidatePath(`/kaiwa/${saved.data.id}`);
  }
  return saved;
}
