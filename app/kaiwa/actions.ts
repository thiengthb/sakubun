'use server';

import { revalidatePath } from 'next/cache';
import { getUserDb } from '@/lib/auth/current-user';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import {
  deleteScript,
  saveScript,
  setScriptVoices,
  type SaveScriptInput,
  type ScriptSummary,
} from '@/lib/kaiwa/scripts';
import { addOpenJlptWord } from '@/lib/kaiwa/lookup';

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

// "Giọng từng vai" (Kaiwa c): the voice chosen for each part of one script.
export async function setVoicesAction(
  scriptId: string,
  voices: Record<string, number>,
): Promise<ActionResult<Record<string, number>>> {
  const saved = await setScriptVoices(await getUserDb(), scriptId, voices);
  if (saved.ok) revalidatePath(`/kaiwa/${scriptId}`);
  return saved.ok ? ok({ ...saved.data }) : saved;
}

// "Thêm vào kho" on a word looked up in a script (K5): the OpenJLPT entry becomes the learner's item.
export async function addWordAction(expression: string): Promise<ActionResult<{ itemId: string }>> {
  const added = await addOpenJlptWord(await getUserDb(), expression);
  if ('reason' in added) return err(added.reason);
  revalidatePath('/resources');
  return ok(added);
}
