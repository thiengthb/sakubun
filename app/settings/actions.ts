'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getSessionUserId } from '@/lib/current-user';
import { createMcpKey } from '@/lib/mcp-key';
import { type ActionResult, err, ok } from '@/lib/action-result';

export type { ActionResult } from '@/lib/action-result';

/**
 * Mint a new MCP token for the current member. Returns the plaintext token ONCE — the caller shows it
 * a single time (it is stored only as a hash and can never be recovered). Claude Desktop pastes it as
 * the endpoint's bearer token to connect AS this member.
 */
export async function createMcpKeyAction(name: string): Promise<ActionResult<{ token: string }>> {
  const label = name.trim();
  if (!label) return err('Đặt tên cho token (ví dụ "laptop")');
  if (label.length > 40) return err('Tên token quá dài (tối đa 40 ký tự)');
  const userId = await getSessionUserId();
  const { token } = await createMcpKey(userId, label);
  revalidatePath('/account');
  return ok({ token });
}

/** Revoke (delete) one of the current member's MCP tokens — takes effect on the next request. */
export async function revokeMcpKeyAction(id: string): Promise<ActionResult> {
  if (!id) return err('Thiếu id token');
  const userId = await getSessionUserId();
  // Scoped by userId so a member can only ever revoke their OWN token (McpKey sits outside the Prisma
  // tenancy guard — it is the auth layer — so the userId filter here is the isolation).
  await prisma.mcpKey.deleteMany({ where: { id, userId } });
  revalidatePath('/account');
  return ok(undefined);
}
