'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/db';
import { getSessionUserId } from '@/lib/auth/current-user';
import { createMcpKey } from '@/lib/auth/mcp-key';
import { type ActionResult, err, ok } from '@/lib/core/action-result';

export async function createMcpKeyAction(name: string): Promise<ActionResult<{ token: string }>> {
  const label = name.trim();
  if (!label) return err('Đặt tên cho token (ví dụ "laptop")');
  if (label.length > 40) return err('Tên token quá dài (tối đa 40 ký tự)');
  const userId = await getSessionUserId();
  const { token } = await createMcpKey(userId, label);
  revalidatePath('/settings');
  return ok({ token });
}

export async function revokeMcpKeyAction(id: string): Promise<ActionResult> {
  if (!id) return err('Thiếu id token');
  const userId = await getSessionUserId();
  await prisma.mcpKey.deleteMany({ where: { id, userId } });
  revalidatePath('/settings');
  return ok(undefined);
}
