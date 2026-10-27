'use server';

import { revalidatePath } from 'next/cache';
import { getAdminUserId } from '@/lib/auth/current-user';
import { deleteAccount, findModerationTarget, setBanned } from '@/lib/admin/accounts';
import { deleteConfirmed, moderationRefusal } from '@/lib/admin/moderation';
import { type ActionResult, err, ok } from '@/lib/core/action-result';

async function target(id: unknown): Promise<ActionResult<{ id: string; email: string }>> {
  const actorId = await getAdminUserId();
  const found = typeof id === 'string' && id ? await findModerationTarget(id) : null;
  const refusal = moderationRefusal(actorId, found);
  return refusal ? err(refusal) : ok({ id: found!.id, email: found!.email });
}

export async function setBannedAction(id: string, banned: boolean): Promise<ActionResult> {
  const t = await target(id);
  if (!t.ok) return t;
  await setBanned(t.data.id, banned === true);
  revalidatePath('/admin', 'layout');
  return ok(undefined);
}

export async function deleteAccountAction(id: string, typedEmail: string): Promise<ActionResult> {
  const t = await target(id);
  if (!t.ok) return t;
  if (!deleteConfirmed(t.data.email, String(typedEmail ?? '')))
    return err('Gõ đúng email của tài khoản để xác nhận xoá.');
  await deleteAccount(t.data.id);
  revalidatePath('/admin', 'layout');
  return ok(undefined);
}
