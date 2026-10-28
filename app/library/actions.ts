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
import { setLike } from '@/lib/library/likes';
import {
  publishGroup,
  publishItem,
  unpublishGroup,
  unpublishItem,
  type PublishResult,
} from '@/lib/library/publish';

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

// Publishing (L3) happens only here, from the learner's own pages: no MCP tool reaches it (rule 4).
const refresh = (path: string) => {
  revalidatePath('/library', 'layout');
  revalidatePath(path);
};

export async function publishItemAction(itemId: string): Promise<ActionResult<PublishResult>> {
  const res = await publishItem(await getUserDb(), itemId);
  if (res.ok) refresh(`/resources/${itemId}`);
  return res;
}

export async function unpublishItemAction(
  itemId: string,
): Promise<ActionResult<{ hidden: number }>> {
  const res = await unpublishItem(await getUserDb(), itemId);
  if (res.ok) refresh(`/resources/${itemId}`);
  return res;
}

export async function publishGroupAction(
  groupId: string,
): Promise<ActionResult<PublishResult & { items: number }>> {
  const res = await publishGroup(await getUserDb(), groupId);
  if (res.ok) refresh(`/groups/${groupId}`);
  return res;
}

export async function unpublishGroupAction(
  groupId: string,
): Promise<ActionResult<{ hidden: number }>> {
  const res = await unpublishGroup(await getUserDb(), groupId);
  if (res.ok) refresh(`/groups/${groupId}`);
  return res;
}

export async function setLikeAction(
  entryId: string,
  liked: boolean,
): Promise<ActionResult<{ liked: boolean; likes: number }>> {
  const res = await setLike(await getUserDb(), entryId, liked);
  if (res.ok) revalidatePath('/library', 'layout');
  return res;
}
