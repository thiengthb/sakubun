'use server';

import { revalidatePath } from 'next/cache';
import { getUserDb } from '@/lib/auth/current-user';
import type { ActionResult } from '@/lib/core/action-result';
import {
  takeEntry,
  takeGroup,
  type TakeEntryResult,
  type TakeGroupResult,
} from '@/lib/library/take';

// "Lấy" on Kho chung (phase 8, L2): the copy itself and its rules live in lib/library/take.ts.
export async function takeEntryAction(entryId: string): Promise<ActionResult<TakeEntryResult>> {
  const taken = await takeEntry(await getUserDb(), entryId);
  if (taken.ok) revalidatePath('/library', 'layout');
  return taken;
}

export async function takeGroupAction(
  groupEntryId: string,
): Promise<ActionResult<TakeGroupResult>> {
  const taken = await takeGroup(await getUserDb(), groupEntryId);
  if (taken.ok) revalidatePath('/library', 'layout');
  return taken;
}
