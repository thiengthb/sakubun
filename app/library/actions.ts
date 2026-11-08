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
import { browseEntries, type LibraryEntryRow } from '@/lib/library/browse';
import { parseBrowseQuery } from '@/lib/library/browse-query';
import {
  publishGroup,
  publishItem,
  unpublishGroup,
  unpublishItem,
  type PublishResult,
} from '@/lib/library/publish';
import {
  publishScript,
  takeScript,
  unpublishScript,
  type TakeScriptResult,
} from '@/lib/library/scripts';
import { libraryScriptRows, type LibraryScriptRow } from '@/lib/library/script-rows';
import { isKanjiLevel, takeKanjiLevel, type TakeKanjiLevelResult } from '@/lib/app/kanji-levels';

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

// A level's kanji (KJ5): a card for each one the learner lacks, met in Ôn nhanh at their own pace.
export async function takeKanjiLevelAction(
  level: string,
): Promise<ActionResult<TakeKanjiLevelResult>> {
  if (!isKanjiLevel(level)) return { ok: false, error: 'Không có nhóm kanji này.' };
  const taken = await takeKanjiLevel(await getUserDb(), level);
  revalidatePath('/library', 'layout');
  return { ok: true, data: taken };
}

// The next page of "Từng mục" as the list scrolls (7.4i). The search comes back from the page as
// URL parameters and is read the same way the page reads its URL.
const MAX_SKIP = 20_000;
export async function moreEntriesAction(
  params: Record<string, string>,
  skip: number,
): Promise<LibraryEntryRow[]> {
  if (!Number.isInteger(skip) || skip < 0 || skip > MAX_SKIP) return [];
  return (await browseEntries(await getUserDb(), parseBrowseQuery(params), skip)).rows;
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

// Kaiwa scripts on Kho chung (K7b): shared from the script's own page, searched and taken on Kho
// chung. A taken script is the learner's own, in Hội thoại.
export async function publishScriptAction(scriptId: string): Promise<ActionResult<PublishResult>> {
  const res = await publishScript(await getUserDb(), scriptId);
  if (res.ok) refresh(`/kaiwa/${scriptId}`);
  return res;
}

export async function unpublishScriptAction(
  scriptId: string,
): Promise<ActionResult<{ hidden: number }>> {
  const res = await unpublishScript(await getUserDb(), scriptId);
  if (res.ok) refresh(`/kaiwa/${scriptId}`);
  return res;
}

export async function takeScriptAction(entryId: string): Promise<ActionResult<TakeScriptResult>> {
  const res = await takeScript(await getUserDb(), entryId);
  if (res.ok) {
    revalidatePath('/library', 'layout');
    revalidatePath('/kaiwa');
  }
  return res;
}

const MAX_SEARCH = 200;
export async function searchScriptsAction(text: string): Promise<LibraryScriptRow[]> {
  if (typeof text !== 'string' || text.length > MAX_SEARCH) return [];
  return libraryScriptRows(await getUserDb(), text);
}
