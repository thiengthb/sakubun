'use server';

import { revalidatePath } from 'next/cache';
import { getUserDb } from '@/lib/auth/current-user';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { deleteScript } from '@/lib/kaiwa/scripts';

export async function deleteScriptAction(scriptId: string): Promise<ActionResult> {
  const db = await getUserDb();
  if (!(await deleteScript(db, scriptId))) {
    return err('Không tìm thấy kịch bản này. Có thể nó đã bị xoá.');
  }
  revalidatePath('/kaiwa');
  return ok(undefined);
}
